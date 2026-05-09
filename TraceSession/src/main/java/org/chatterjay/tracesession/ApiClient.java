package org.chatterjay.tracesession;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.mojang.logging.LogUtils;
import org.slf4j.Logger;

import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.security.cert.X509Certificate;

public class ApiClient
{
    private static final Logger LOGGER = LogUtils.getLogger();
    private final HttpClient client;
    private final String baseUrl;

    public ApiClient(String baseUrl)
    {
        this.baseUrl = baseUrl;
        var builder = HttpClient.newBuilder();
        if (baseUrl.startsWith("https://"))
        {
            builder.sslContext(createTrustAllContext());
        }
        this.client = builder.build();
    }

    private static SSLContext createTrustAllContext()
    {
        try {
            var trustManager = new X509TrustManager() {
                public void checkClientTrusted(X509Certificate[] chain, String authType) {}
                public void checkServerTrusted(X509Certificate[] chain, String authType) {}
                public X509Certificate[] getAcceptedIssuers() { return new X509Certificate[0]; }
            };
            var sslContext = SSLContext.getInstance("TLS");
            sslContext.init(null, new TrustManager[]{trustManager}, null);
            return sslContext;
        } catch (Exception e) {
            LOGGER.error("Failed to create SSL context: {}", e.getMessage());
            return null;
        }
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

    public void sendHeartbeat(String serverId, String serverName, String address, double tps, double mtps, String gameMode, String modLoader)
    {
        var json = buildHeartbeatJson(serverId, serverName, address, tps, mtps, gameMode, modLoader);

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

    public JsonObject sendHeartbeatSync(String serverId, String serverName, String address, double tps, double mtps, String gameMode, String modLoader)
    {
        try {
            var json = buildHeartbeatJson(serverId, serverName, address, tps, mtps, gameMode, modLoader);
            var request = HttpRequest.newBuilder()
                    .uri(URI.create(baseUrl + "/api/servers/heartbeat"))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json.toString()))
                    .build();
            var response = client.send(request, HttpResponse.BodyHandlers.ofString());
            return JsonParser.parseString(response.body()).getAsJsonObject();
        } catch (Exception e) {
            LOGGER.error("Failed to send heartbeat: {}", e.getMessage());
            return null;
        }
    }

    private JsonObject buildHeartbeatJson(String serverId, String serverName, String address, double tps, double mtps, String gameMode, String modLoader)
    {
        var json = new JsonObject();
        json.addProperty("serverId", serverId);
        json.addProperty("serverName", serverName);
        json.addProperty("address", address);
        json.addProperty("tps", tps);
        json.addProperty("mtps", mtps);
        json.addProperty("gameMode", gameMode);
        json.addProperty("modLoader", modLoader);
        return json;
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

    public void sendChat(String serverId, String playerName, String message)
    {
        var json = new JsonObject();
        json.addProperty("playerName", playerName);
        json.addProperty("message", message);

        var request = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "/api/servers/" + serverId + "/chat"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json.toString()))
                .build();

        client.sendAsync(request, HttpResponse.BodyHandlers.ofString())
                .exceptionally(e -> {
                    LOGGER.error("Failed to send chat: {}", e.getMessage());
                    return null;
                });
    }
}
