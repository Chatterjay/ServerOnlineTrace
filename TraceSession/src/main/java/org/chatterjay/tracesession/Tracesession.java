package org.chatterjay.tracesession;

import com.google.gson.JsonObject;
import com.mojang.logging.LogUtils;
import net.minecraft.server.MinecraftServer;
import net.minecraftforge.common.MinecraftForge;
import net.minecraftforge.event.TickEvent;
import net.minecraftforge.event.server.ServerStartingEvent;
import net.minecraftforge.event.server.ServerStoppingEvent;
import net.minecraftforge.eventbus.api.SubscribeEvent;
import net.minecraftforge.fml.ModList;
import net.minecraftforge.fml.ModLoadingContext;
import net.minecraftforge.fml.common.Mod;
import net.minecraftforge.fml.config.ModConfig;
import org.slf4j.Logger;
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
    private String modVersion;

    public Tracesession()
    {
        MinecraftForge.EVENT_BUS.register(new PlayerEventListener());
        MinecraftForge.EVENT_BUS.register(this);
        ModLoadingContext.get().registerConfig(ModConfig.Type.COMMON, Config.SPEC);
        try {
            modVersion = ModList.get().getModContainerById(MODID)
                    .map(c -> c.getModInfo().getVersion().toString())
                    .orElse("1.0-SNAPSHOT");
        } catch (Exception e) {
            modVersion = "1.0-SNAPSHOT";
        }
    }

    public static ApiClient getApiClient()
    {
        if (apiClient == null)
        {
            apiClient = new ApiClient(Config.backendUrl);
        }
        return apiClient;
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
                        String gameMode = minecraftServer.getDefaultGameType().getName();
                        String gameVersion = minecraftServer.getServerVersion();
                        JsonObject response = getApiClient().sendHeartbeatSync(
                                Config.serverId, Config.serverName, serverAddress,
                                currentTps, currentMtps, gameMode, Config.modLoader, modVersion, gameVersion
                        );
                        if (response != null && response.has("commands") && !response.get("commands").isJsonNull())
                        {
                            var commands = response.getAsJsonArray("commands");
                            for (var elem : commands)
                            {
                                var cmdObj = elem.getAsJsonObject();
                                String text = cmdObj.get("command").getAsString();
                                minecraftServer.execute(() -> {
                                    try {
                                        if (text.startsWith("/")) {
                                            var source = minecraftServer.createCommandSourceStack().withPermission(0);
                                            minecraftServer.getCommands().performPrefixedCommand(source, text);
                                            LOGGER.info("Executed command: {}", text);
                                        } else {
                                            var msg = net.minecraft.network.chat.Component.literal("§7[网站] §f" + text);
                                            minecraftServer.getPlayerList().broadcastSystemMessage(msg, false);
                                            LOGGER.info("Broadcast chat: {}", text);
                                        }
                                    } catch (Exception ex) {
                                        LOGGER.error("Failed to execute '{}': {}", text, ex.getMessage());
                                    }
                                });
                            }
                        }
                    } catch (Exception e) {
                        LOGGER.error("Heartbeat/command error: {}", e.getMessage());
                    }
                },
                0, 30, TimeUnit.SECONDS
        );
        LOGGER.info("Heartbeat started (every 30s) -> {} ({})", Config.backendUrl, serverAddress);
    }

    @SubscribeEvent
    public void onServerTick(TickEvent.ServerTickEvent event)
    {
        if (event.phase == TickEvent.Phase.END) {
            long now = System.nanoTime();
            if (lastTickTime != 0) {
                currentMtps = (now - lastTickTime) / 1_000_000.0;
                currentTps = currentMtps > 50.0 ? 1000.0 / currentMtps : 20.0;
            }
            lastTickTime = now;
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
