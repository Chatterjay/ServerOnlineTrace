package org.chatterjay.tracesession;

import com.google.gson.JsonObject;
import com.mojang.logging.LogUtils;
import org.slf4j.Logger;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

public class ApiClient
{
    private static final Logger LOGGER = LogUtils.getLogger();
    private final HttpClient client = HttpClient.newHttpClient();
    private final String baseUrl;

    public ApiClient(String baseUrl)
    {
        this.baseUrl = baseUrl;
    }

    public void sendEvent(String serverId, String playerUuid, String playerName, String type)
    {
        var json = new JsonObject();
        json.addProperty("serverId", serverId);
        json.addProperty("playerUuid", playerUuid);
        json.addProperty("playerName", playerName);
        json.addProperty("type", type);

        var request = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "/api/events"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json.toString()))
                .build();

        client.sendAsync(request, HttpResponse.BodyHandlers.ofString())
                .exceptionally(e -> {
                    LOGGER.error("Failed to send event: {}", e.getMessage());
                    return null;
                });
    }

    public void sendHeartbeat(String serverId, String serverName, String address, double tps, double mtps)
    {
        var json = new JsonObject();
        json.addProperty("serverId", serverId);
        json.addProperty("serverName", serverName);
        json.addProperty("address", address);
        json.addProperty("tps", tps);
        json.addProperty("mtps", mtps);

        var request = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "/api/servers/heartbeat"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json.toString()))
                .build();

        client.sendAsync(request, HttpResponse.BodyHandlers.ofString())
                .exceptionally(e -> {
                    LOGGER.error("Failed to send heartbeat: {}", e.getMessage());
                    return null;
                });
    }

    public void sendOffline(String serverId, String serverName, String address)
    {
        var json = new JsonObject();
        json.addProperty("serverId", serverId);
        json.addProperty("serverName", serverName);
        json.addProperty("address", address);
        json.addProperty("status", "offline");

        var request = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "/api/servers/heartbeat"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json.toString()))
                .build();

        client.sendAsync(request, HttpResponse.BodyHandlers.ofString());
        LOGGER.info("Offline heartbeat sent for {}", serverName);
    }
}
