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

    private HttpRequest.Builder request(String path)
    {
        var builder = HttpRequest.newBuilder().uri(URI.create(baseUrl + path));
        if (Config.apiKey != null && !Config.apiKey.isBlank()) {
            builder.header("x-tracesession-key", Config.apiKey);
        }
        return builder;
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

        var request = request("/api/events")
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json.toString()))
                .build();

        client.sendAsync(request, HttpResponse.BodyHandlers.ofString())
                .exceptionally(e -> {
                    LOGGER.error("Failed to send event", e);
                    return null;
                });
    }

    public void sendHeartbeat(String serverId, String serverName, String address, double tps, double mtps, int maxPlayers, String gameMode, String modLoader, String modVersion, String gameVersion)
    {
        var json = buildHeartbeatJson(serverId, serverName, address, tps, mtps, maxPlayers, gameMode, modLoader, modVersion, gameVersion);

        var request = request("/api/servers/heartbeat")
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json.toString()))
                .build();

        client.sendAsync(request, HttpResponse.BodyHandlers.ofString())
                .exceptionally(e -> {
                    LOGGER.error("Failed to send heartbeat", e);
                    return null;
                });
    }

    public JsonObject sendHeartbeatSync(String serverId, String serverName, String address, double tps, double mtps, int maxPlayers, String gameMode, String modLoader, String modVersion, String gameVersion, JsonArray onlinePlayers)
    {
        try {
            var json = buildHeartbeatJson(serverId, serverName, address, tps, mtps, maxPlayers, gameMode, modLoader, modVersion, gameVersion);
            json.add("onlinePlayers", onlinePlayers);
            var request = request("/api/servers/heartbeat")
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json.toString()))
                    .build();
            var response = client.send(request, HttpResponse.BodyHandlers.ofString());
            return JsonParser.parseString(response.body()).getAsJsonObject();
        } catch (Exception e) {
            LOGGER.error("Failed to send heartbeat", e);
            return null;
        }
    }

    private JsonObject buildHeartbeatJson(String serverId, String serverName, String address, double tps, double mtps, int maxPlayers, String gameMode, String modLoader, String modVersion, String gameVersion)
    {
        var json = new JsonObject();
        json.addProperty("serverId", serverId);
        json.addProperty("serverName", serverName);
        json.addProperty("address", address);
        json.addProperty("tps", tps);
        json.addProperty("mtps", mtps);
        json.addProperty("maxPlayers", maxPlayers);
        json.addProperty("gameMode", gameMode);
        json.addProperty("modLoader", modLoader);
        json.addProperty("modVersion", modVersion);
        json.addProperty("gameVersion", gameVersion);
        return json;
    }

    public void sendOffline(String serverId, String serverName, String address)
    {
        var json = new JsonObject();
        json.addProperty("serverId", serverId);
        json.addProperty("serverName", serverName);
        json.addProperty("address", address);
        json.addProperty("status", "offline");

        var request = request("/api/servers/heartbeat")
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json.toString()))
                .build();

        client.sendAsync(request, HttpResponse.BodyHandlers.ofString());
        LOGGER.info("Offline heartbeat sent for {}", serverName);
    }

    public JsonArray pollPendingCommands(String serverId)
    {
        try {
            var request = request("/api/servers/" + serverId + "/commands/pending")
                    .GET()
                    .build();
            var response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                LOGGER.warn("Command poll failed: HTTP {} {}", response.statusCode(), response.body());
                return new JsonArray();
            }
            var body = JsonParser.parseString(response.body()).getAsJsonObject();
            return body.has("commands") && body.get("commands").isJsonArray()
                    ? body.getAsJsonArray("commands")
                    : new JsonArray();
        } catch (Exception e) {
            LOGGER.error("Failed to poll commands", e);
            return new JsonArray();
        }
    }

    public JsonArray pollPendingOverviewRequests(String serverId)
    {
        try {
            var request = request("/api/servers/" + serverId + "/overview/requests/pending")
                    .GET()
                    .build();
            var response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                LOGGER.warn("Overview request poll failed: HTTP {} {}", response.statusCode(), response.body());
                return new JsonArray();
            }
            var body = JsonParser.parseString(response.body()).getAsJsonObject();
            return body.has("overviewRequests") && body.get("overviewRequests").isJsonArray()
                    ? body.getAsJsonArray("overviewRequests")
                    : new JsonArray();
        } catch (Exception e) {
            LOGGER.error("Failed to poll overview requests", e);
            return new JsonArray();
        }
    }

    public void sendChat(String serverId, String playerUuid, String playerName, String message)
    {
        var json = new JsonObject();
        json.addProperty("playerUuid", playerUuid);
        json.addProperty("playerName", playerName);
        json.addProperty("message", message);

        var request = request("/api/servers/" + serverId + "/chat")
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json.toString()))
                .build();

        client.sendAsync(request, HttpResponse.BodyHandlers.ofString())
                .exceptionally(e -> {
                    LOGGER.error("Failed to send chat", e);
                    return null;
                });
    }

    public boolean sendDebugPlaytime(String serverId, String playerUuid, String playerName, int seconds)
    {
        var json = new JsonObject();
        json.addProperty("playerUuid", playerUuid);
        json.addProperty("playerName", playerName);
        json.addProperty("seconds", seconds);
        return postDebug("/api/servers/" + serverId + "/debug/playtime", json);
    }

    public boolean sendDebugSeed(String serverId, int count)
    {
        var json = new JsonObject();
        json.addProperty("count", count);
        return postDebug("/api/servers/" + serverId + "/debug/seed", json);
    }

    private boolean postDebug(String path, JsonObject json)
    {
        try {
            var request = request(path)
                    .header("Content-Type", "application/json")
                    .header("x-tracesession-debug", "enabled")
                    .POST(HttpRequest.BodyPublishers.ofString(json.toString()))
                    .build();
            var response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                LOGGER.warn("TraceSession debug API failed: HTTP {} {}", response.statusCode(), response.body());
                return false;
            }
            return true;
        } catch (Exception e) {
            LOGGER.error("Failed to call TraceSession debug API", e);
            return false;
        }
    }
}
