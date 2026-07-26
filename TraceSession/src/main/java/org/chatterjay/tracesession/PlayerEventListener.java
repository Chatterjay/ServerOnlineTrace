package org.chatterjay.tracesession;

import com.mojang.logging.LogUtils;
import net.minecraft.network.chat.Component;
import net.neoforged.bus.api.SubscribeEvent;
import net.neoforged.neoforge.event.ServerChatEvent;
import net.neoforged.neoforge.event.entity.player.PlayerEvent;
import org.slf4j.Logger;

import java.util.concurrent.CompletableFuture;

public class PlayerEventListener
{
    private static final Logger LOGGER = LogUtils.getLogger();
    private final Tracesession tracesession;

    public PlayerEventListener(Tracesession tracesession)
    {
        this.tracesession = tracesession;
    }

    @SubscribeEvent
    public void onPlayerLoggedIn(PlayerEvent.PlayerLoggedInEvent event)
    {
        var player = event.getEntity();
        var server = player.getServer();
        if (server != null)
        {
            var msg = Component.literal("§e" + player.getName().getString() + "§e 加入了游戏");
            server.getPlayerList().broadcastSystemMessage(msg, false);
        }
        LOGGER.info("Player joined: {} (UUID: {})", player.getName().getString(), player.getUUID());
        Tracesession.getApiClient().sendEvent(Config.serverId, player.getUUID().toString(), player.getName().getString(), "join");
        sendFreshHeartbeat();
    }

    @SubscribeEvent
    public void onPlayerLoggedOut(PlayerEvent.PlayerLoggedOutEvent event)
    {
        var player = event.getEntity();
        var server = player.getServer();
        if (server != null)
        {
            var msg = Component.literal("§e" + player.getName().getString() + "§e 离开了游戏");
            server.getPlayerList().broadcastSystemMessage(msg, false);
        }
        LOGGER.info("Player left: {} (UUID: {})", player.getName().getString(), player.getUUID());
        Tracesession.getApiClient().sendEvent(Config.serverId, player.getUUID().toString(), player.getName().getString(), "leave");
    }

    @SubscribeEvent
    public void onPlayerClone(PlayerEvent.Clone event)
    {
        if (event.isWasDeath())
        {
            var player = event.getEntity();
            Tracesession.getApiClient().sendEvent(Config.serverId, player.getUUID().toString(), player.getName().getString(), "death");
            sendFreshHeartbeat();
            LOGGER.info("Player died: {} (UUID: {})", player.getName().getString(), player.getUUID());
        }
    }

    @SubscribeEvent
    public void onPlayerChat(ServerChatEvent event)
    {
        String playerName = event.getUsername();
        String message = event.getMessage().getString();
        Tracesession.getApiClient().sendChat(Config.serverId, event.getPlayer().getUUID().toString(), playerName, message);
        LOGGER.info("Player chat: {}: {}", playerName, message);
    }

    private void sendFreshHeartbeat()
    {
        try {
            tracesession.refreshOnlinePlayersSnapshot();
            CompletableFuture.runAsync(tracesession::sendImmediateHeartbeat);
        } catch (Exception e) {
            LOGGER.warn("Failed to send immediate TraceSession heartbeat: {}", e.getMessage());
        }
    }
}
