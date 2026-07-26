package org.chatterjay.tracesession;

import com.mojang.brigadier.arguments.IntegerArgumentType;
import com.mojang.brigadier.arguments.StringArgumentType;
import net.minecraft.commands.Commands;
import net.minecraft.network.chat.Component;
import net.neoforged.bus.api.SubscribeEvent;
import net.neoforged.neoforge.event.RegisterCommandsEvent;

public class TraceSessionDebugCommands
{
    private final Tracesession tracesession;

    public TraceSessionDebugCommands(Tracesession tracesession)
    {
        this.tracesession = tracesession;
    }

    @SubscribeEvent
    public void onRegisterCommands(RegisterCommandsEvent event)
    {
        event.getDispatcher().register(
                Commands.literal("tracesession")
                        .requires(source -> source.hasPermission(2))
                        .then(Commands.literal("status")
                                .executes(ctx -> status(ctx.getSource())))
                        .then(Commands.literal("heartbeat")
                                .executes(ctx -> heartbeat(ctx.getSource())))
                        .then(Commands.literal("snapshot-all")
                                .executes(ctx -> snapshotAll(ctx.getSource())))
                        .then(Commands.literal("fake-death")
                                .then(Commands.argument("player", StringArgumentType.word())
                                        .executes(ctx -> fakeDeath(ctx.getSource(), StringArgumentType.getString(ctx, "player")))))
                        .then(Commands.literal("set-playtime")
                                .then(Commands.argument("player", StringArgumentType.word())
                                        .then(Commands.argument("seconds", IntegerArgumentType.integer(0))
                                                .executes(ctx -> setPlaytime(
                                                        ctx.getSource(),
                                                        StringArgumentType.getString(ctx, "player"),
                                                        IntegerArgumentType.getInteger(ctx, "seconds")
                                                )))))
                        .then(Commands.literal("seed")
                                .then(Commands.argument("count", IntegerArgumentType.integer(1, 50))
                                        .executes(ctx -> seed(ctx.getSource(), IntegerArgumentType.getInteger(ctx, "count")))))
        );
    }

    private int status(net.minecraft.commands.CommandSourceStack source)
    {
        int players = tracesession.getMinecraftServer() == null ? 0 : tracesession.getMinecraftServer().getPlayerList().getPlayerCount();
        int maxPlayers = tracesession.getMinecraftServer() == null ? 0 : tracesession.getMinecraftServer().getPlayerList().getMaxPlayers();
        source.sendSuccess(() -> Component.literal(
                "TraceSession backend=" + Config.backendUrl
                        + " serverId=" + Config.serverId
                        + " debug=" + Config.enableDebugCommands
                        + " players=" + players + "/" + maxPlayers
                        + " TPS=" + String.format("%.1f", tracesession.getCurrentTps())
                        + " MSPT=" + String.format("%.0f", tracesession.getCurrentMtps())
        ), false);
        return 1;
    }

    private int heartbeat(net.minecraft.commands.CommandSourceStack source)
    {
        tracesession.refreshOnlinePlayersSnapshot();
        var response = tracesession.sendImmediateHeartbeat();
        if (response == null) {
            source.sendFailure(Component.translatable("tracesession.command.heartbeat_failed"));
            return 0;
        }
        source.sendSuccess(() -> Component.translatable("tracesession.command.heartbeat_sent"), false);
        return 1;
    }

    private int snapshotAll(net.minecraft.commands.CommandSourceStack source)
    {
        tracesession.refreshOnlinePlayersSnapshot();
        int count = tracesession.buildOnlinePlayersSnapshot().size();
        var response = tracesession.sendImmediateHeartbeat();
        if (response == null) {
            source.sendFailure(Component.translatable("tracesession.command.snapshot_failed"));
            return 0;
        }
        source.sendSuccess(() -> Component.translatable("tracesession.command.snapshot_sent", count), false);
        return count;
    }

    private int fakeDeath(net.minecraft.commands.CommandSourceStack source, String playerName)
    {
        var player = findPlayer(playerName);
        if (player == null) {
            source.sendFailure(Component.translatable("tracesession.command.player_not_online", playerName));
            return 0;
        }
        Tracesession.getApiClient().sendEvent(Config.serverId, player.getUUID().toString(), player.getName().getString(), "death");
        source.sendSuccess(() -> Component.translatable("tracesession.command.fake_death_sent", player.getName().getString()), false);
        return 1;
    }

    private int setPlaytime(net.minecraft.commands.CommandSourceStack source, String playerName, int seconds)
    {
        if (!Config.enableDebugCommands) {
            source.sendFailure(Component.translatable("tracesession.command.debug_disabled"));
            return 0;
        }
        var player = findPlayer(playerName);
        if (player == null) {
            source.sendFailure(Component.translatable("tracesession.command.player_not_online", playerName));
            return 0;
        }
        boolean ok = Tracesession.getApiClient().sendDebugPlaytime(Config.serverId, player.getUUID().toString(), player.getName().getString(), seconds);
        if (!ok) {
            source.sendFailure(Component.translatable("tracesession.command.set_playtime_failed"));
            return 0;
        }
        source.sendSuccess(() -> Component.translatable("tracesession.command.set_playtime_sent", seconds, player.getName().getString()), false);
        return 1;
    }

    private int seed(net.minecraft.commands.CommandSourceStack source, int count)
    {
        if (!Config.enableDebugCommands) {
            source.sendFailure(Component.translatable("tracesession.command.debug_disabled"));
            return 0;
        }
        boolean ok = Tracesession.getApiClient().sendDebugSeed(Config.serverId, count);
        if (!ok) {
            source.sendFailure(Component.translatable("tracesession.command.seed_failed"));
            return 0;
        }
        source.sendSuccess(() -> Component.translatable("tracesession.command.seed_sent", count), false);
        return count;
    }

    private net.minecraft.server.level.ServerPlayer findPlayer(String playerName)
    {
        if (tracesession.getMinecraftServer() == null) return null;
        for (var player : tracesession.getMinecraftServer().getPlayerList().getPlayers()) {
            if (player.getName().getString().equalsIgnoreCase(playerName)) return player;
        }
        return null;
    }
}
