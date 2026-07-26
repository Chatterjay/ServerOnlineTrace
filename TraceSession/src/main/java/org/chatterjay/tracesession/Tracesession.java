package org.chatterjay.tracesession;

import com.google.gson.JsonObject;
import com.mojang.logging.LogUtils;
import com.google.gson.JsonArray;
import net.minecraft.core.BlockPos;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.animal.Animal;
import net.minecraft.world.entity.item.ItemEntity;
import net.minecraft.world.entity.monster.Monster;
import net.minecraft.world.entity.ExperienceOrb;
import net.minecraft.world.level.levelgen.Heightmap;
import net.minecraft.world.phys.AABB;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.bus.api.SubscribeEvent;
import net.neoforged.fml.ModContainer;
import net.neoforged.fml.common.Mod;
import net.neoforged.fml.config.ModConfig;
import net.neoforged.neoforge.common.NeoForge;
import net.neoforged.neoforge.event.server.ServerStartingEvent;
import net.neoforged.neoforge.event.server.ServerStoppingEvent;
import net.neoforged.neoforge.event.tick.ServerTickEvent;
import org.slf4j.Logger;

import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@Mod(Tracesession.MODID)
public class Tracesession
{
    public static final String MODID = "tracesession";
    private static final Logger LOGGER = LogUtils.getLogger();
    private static ApiClient apiClient;
    private ScheduledExecutorService scheduler;
    private String serverAddress = "";
    private MinecraftServer minecraftServer;
    private double currentTps = 20.0;
    private double currentMtps = 0.0;
    private long lastTickTime = 0;
    private final double[] recentTickMs = new double[100];
    private int recentTickIndex = 0;
    private int recentTickCount = 0;
    private int snapshotTickCounter = 0;
    private JsonArray cachedOnlinePlayersSnapshot = new JsonArray();
    private String modVersion;
    private final Set<String> requestedOverviewUuids = new HashSet<>();
    private static final int OVERVIEW_RADIUS = 10;

    public Tracesession(IEventBus modEventBus, ModContainer modContainer)
    {
        NeoForge.EVENT_BUS.register(new PlayerEventListener(this));
        NeoForge.EVENT_BUS.register(this);
        NeoForge.EVENT_BUS.register(new TraceSessionDebugCommands(this));
        modContainer.registerConfig(ModConfig.Type.COMMON, Config.SPEC);
        modVersion = modContainer.getModInfo().getVersion().toString();
    }

    public static ApiClient getApiClient()
    {
        if (apiClient == null)
        {
            apiClient = new ApiClient(Config.backendUrl);
        }
        return apiClient;
    }

    public MinecraftServer getMinecraftServer()
    {
        return minecraftServer;
    }

    public String getServerAddress()
    {
        return serverAddress;
    }

    public double getCurrentTps()
    {
        return currentTps;
    }

    public double getCurrentMtps()
    {
        return currentMtps;
    }

    public String getModVersion()
    {
        return modVersion;
    }

    public JsonArray buildOnlinePlayersSnapshot()
    {
        return buildOnlinePlayersSnapshot(Set.of());
    }

    public JsonArray buildOnlinePlayersSnapshot(Set<String> overviewUuids)
    {
        var onlinePlayers = new JsonArray();
        if (minecraftServer == null) return onlinePlayers;
        for (var player : minecraftServer.getPlayerList().getPlayers()) {
            String uuid = player.getUUID().toString();
            var playerJson = new JsonObject();
            var pos = player.blockPosition();
            playerJson.addProperty("uuid", uuid);
            playerJson.addProperty("name", player.getName().getString());
            playerJson.addProperty("dimension", player.level().dimension().location().toString());
            playerJson.addProperty("x", pos.getX());
            playerJson.addProperty("y", pos.getY());
            playerJson.addProperty("z", pos.getZ());
            playerJson.addProperty("health", player.getHealth());
            playerJson.addProperty("maxHealth", player.getMaxHealth());
            playerJson.addProperty("foodLevel", player.getFoodData().getFoodLevel());
            playerJson.addProperty("experienceLevel", player.experienceLevel);
            playerJson.addProperty("gameMode", player.gameMode.getGameModeForPlayer().getName());
            playerJson.addProperty("latency", player.connection.latency());
            if (overviewUuids.contains(uuid)) {
                playerJson.add("overview", buildPlayerOverview(player.blockPosition(), player.serverLevel(), uuid));
            }
            onlinePlayers.add(playerJson);
        }
        return onlinePlayers;
    }

    private JsonObject buildPlayerOverview(BlockPos center, net.minecraft.server.level.ServerLevel level, String sourcePlayerUuid)
    {
        var overview = new JsonObject();
        var cells = new JsonArray();
        int radius = OVERVIEW_RADIUS;
        for (int dz = -radius; dz <= radius; dz++) {
            for (int dx = -radius; dx <= radius; dx++) {
                int x = center.getX() + dx;
                int z = center.getZ() + dz;
                int y = level.getHeight(Heightmap.Types.MOTION_BLOCKING, x, z) - 1;
                var blockPos = new BlockPos(x, y, z);
                var blockState = level.getBlockState(blockPos);
                var cell = new JsonObject();
                cell.addProperty("dx", dx);
                cell.addProperty("dz", dz);
                cell.addProperty("y", y);
                cell.addProperty("block", BuiltInRegistries.BLOCK.getKey(blockState.getBlock()).toString());
                cell.addProperty("color", String.format("#%06x", blockState.getMapColor(level, blockPos).col & 0xFFFFFF));
                cells.add(cell);
            }
        }
        overview.addProperty("radius", radius);
        overview.addProperty("centerX", center.getX());
        overview.addProperty("centerY", center.getY());
        overview.addProperty("centerZ", center.getZ());
        overview.add("cells", cells);
        overview.add("entities", buildNearbyEntities(center, level, sourcePlayerUuid, radius));
        return overview;
    }

    private JsonArray buildNearbyEntities(BlockPos center, net.minecraft.server.level.ServerLevel level, String sourcePlayerUuid, int radius)
    {
        var entities = new JsonArray();
        var box = new AABB(
                center.getX() - radius, center.getY() - 64, center.getZ() - radius,
                center.getX() + radius + 1, center.getY() + 64, center.getZ() + radius + 1
        );
        for (Entity entity : level.getEntities((Entity) null, box, entity -> !entity.isRemoved()))
        {
            String uuid = entity.getUUID().toString();
            if (uuid.equals(sourcePlayerUuid)) continue;
            var pos = entity.blockPosition();
            int dx = pos.getX() - center.getX();
            int dz = pos.getZ() - center.getZ();
            if (Math.abs(dx) > radius || Math.abs(dz) > radius) continue;

            var item = new JsonObject();
            String category = entityCategory(entity);
            item.addProperty("uuid", uuid);
            item.addProperty("type", BuiltInRegistries.ENTITY_TYPE.getKey(entity.getType()).toString());
            item.addProperty("name", entity.getDisplayName().getString());
            item.addProperty("category", category);
            item.addProperty("dx", dx);
            item.addProperty("dz", dz);
            item.addProperty("y", pos.getY());
            item.addProperty("color", entityColor(category));
            entities.add(item);
            if (entities.size() >= 120) break;
        }
        return entities;
    }

    private String entityCategory(Entity entity)
    {
        if (entity instanceof ServerPlayer) return "player";
        if (entity instanceof Monster) return "monster";
        if (entity instanceof Animal) return "animal";
        if (entity instanceof ItemEntity || entity instanceof ExperienceOrb) return "item";
        return "entity";
    }

    private String entityColor(String category)
    {
        return switch (category) {
            case "player" -> "#409eff";
            case "monster" -> "#f56c6c";
            case "animal" -> "#67c23a";
            case "item" -> "#e6a23c";
            default -> "#a855f7";
        };
    }

    private synchronized void updateCachedOnlinePlayersSnapshot()
    {
        Set<String> overviewUuids = takeRequestedOverviewUuids();
        cachedOnlinePlayersSnapshot = buildOnlinePlayersSnapshot(overviewUuids);
        if (!overviewUuids.isEmpty()) {
            CompletableFuture.runAsync(() -> processHeartbeatResponse(sendImmediateHeartbeat()));
        }
    }

    public void refreshOnlinePlayersSnapshot()
    {
        updateCachedOnlinePlayersSnapshot();
    }

    private synchronized JsonArray getCachedOnlinePlayersSnapshot()
    {
        return cachedOnlinePlayersSnapshot.deepCopy();
    }

    public JsonObject sendImmediateHeartbeat()
    {
        if (minecraftServer == null) return null;
        String gameMode = minecraftServer.getDefaultGameType().getName();
        String gameVersion = minecraftServer.getServerVersion();
        int maxPlayers = minecraftServer.getPlayerList().getMaxPlayers();
        int onlinePlayers = minecraftServer.getPlayerList().getPlayerCount();
        LOGGER.info(
                "TraceSession heartbeat payload: serverId={} players={}/{} TPS={} MSPT={}",
                Config.serverId,
                onlinePlayers,
                maxPlayers,
                String.format("%.1f", currentTps),
                String.format("%.0f", currentMtps)
        );
        return getApiClient().sendHeartbeatSync(
                Config.serverId, Config.serverName, serverAddress,
                currentTps, currentMtps, maxPlayers, gameMode, Config.modLoader, modVersion, gameVersion, getCachedOnlinePlayersSnapshot()
        );
    }

    private synchronized void requestPlayerOverviews(JsonArray overviewRequests)
    {
        if (overviewRequests == null || overviewRequests.isEmpty()) return;
        for (var elem : overviewRequests)
        {
            if (elem != null && elem.isJsonPrimitive()) {
                requestedOverviewUuids.add(elem.getAsString());
            }
        }
    }

    private synchronized Set<String> takeRequestedOverviewUuids()
    {
        if (requestedOverviewUuids.isEmpty()) return Set.of();
        var copy = new HashSet<>(requestedOverviewUuids);
        requestedOverviewUuids.clear();
        return copy;
    }

    private void processHeartbeatResponse(JsonObject response)
    {
        if (response == null) return;
        if (response.has("commands") && !response.get("commands").isJsonNull())
        {
            executeQueuedCommands(response.getAsJsonArray("commands"));
        }
        if (response.has("overviewRequests") && response.get("overviewRequests").isJsonArray())
        {
            requestPlayerOverviews(response.getAsJsonArray("overviewRequests"));
        }
    }

    private void executeQueuedCommands(JsonArray commands)
    {
        if (minecraftServer == null || commands == null || commands.isEmpty()) return;
        for (var elem : commands)
        {
            var cmdObj = elem.getAsJsonObject();
            String text = cmdObj.get("command").getAsString();
            minecraftServer.execute(() -> {
                try {
                    if (text.startsWith("/")) {
                        var source = minecraftServer.createCommandSourceStack().withPermission(0);
                        minecraftServer.getCommands().performPrefixedCommand(source, text);
                        LOGGER.info("Executed web terminal command as permission level 0: {}", text);
                    } else {
                        var msg = text.startsWith("[")
                                ? net.minecraft.network.chat.Component.literal("§7" + text)
                                : net.minecraft.network.chat.Component.translatable("tracesession.chat.website", text);
                        minecraftServer.getPlayerList().broadcastSystemMessage(msg, false);
                        LOGGER.info("Broadcast chat: {}", text);
                    }
                } catch (Exception ex) {
                    LOGGER.error("Failed to execute '{}'", text, ex);
                }
            });
        }
    }

    @SubscribeEvent
    public void onServerStarting(ServerStartingEvent event)
    {
        minecraftServer = event.getServer();
        String ip = minecraftServer.getLocalIp();
        if (ip == null || ip.isBlank()) {
            try {
                ip = java.net.InetAddress.getLocalHost().getHostAddress();
            } catch (Exception e) {
                ip = "0.0.0.0";
            }
        }
        serverAddress = ip + ":" + minecraftServer.getPort();

        scheduler = Executors.newSingleThreadScheduledExecutor();
        scheduler.scheduleAtFixedRate(
                () -> {
                    try {
                        processHeartbeatResponse(sendImmediateHeartbeat());
                    } catch (Exception e) {
                        LOGGER.error("Heartbeat/command error: {}", e.getMessage());
                    }
                },
                0, 30, TimeUnit.SECONDS
        );
        scheduler.scheduleAtFixedRate(
                () -> {
                    executeQueuedCommands(getApiClient().pollPendingCommands(Config.serverId));
                    requestPlayerOverviews(getApiClient().pollPendingOverviewRequests(Config.serverId));
                },
                1, Config.commandPollSeconds, TimeUnit.SECONDS
        );
        LOGGER.info("Heartbeat started (every 30s), command poll every {}s -> {} ({})", Config.commandPollSeconds, Config.backendUrl, serverAddress);
    }

    @SubscribeEvent
    public void onServerTick(ServerTickEvent.Post event)
    {
        long now = System.nanoTime();
        if (lastTickTime != 0) {
            double tickMs = (now - lastTickTime) / 1_000_000.0;
            recentTickMs[recentTickIndex] = tickMs;
            recentTickIndex = (recentTickIndex + 1) % recentTickMs.length;
            recentTickCount = Math.min(recentTickCount + 1, recentTickMs.length);
            double total = 0.0;
            for (int i = 0; i < recentTickCount; i++) {
                total += recentTickMs[i];
            }
            currentMtps = total / recentTickCount;
            currentTps = Math.min(20.0, 1000.0 / Math.max(currentMtps, 1.0));
        }
        lastTickTime = now;
        snapshotTickCounter++;
        if (snapshotTickCounter >= 20) {
            snapshotTickCounter = 0;
            updateCachedOnlinePlayersSnapshot();
        }
    }

    @SubscribeEvent
    public void onServerStopping(ServerStoppingEvent event)
    {
        if (scheduler != null && !scheduler.isShutdown())
        {
            scheduler.shutdown();
        }
        getApiClient().sendOffline(Config.serverId, Config.serverName, serverAddress);
        LOGGER.info("Heartbeat stopped");
    }
}
