package org.chatterjay.tracesession;

import net.neoforged.bus.api.SubscribeEvent;
import net.neoforged.fml.common.EventBusSubscriber;
import net.neoforged.fml.event.config.ModConfigEvent;
import net.neoforged.neoforge.common.ModConfigSpec;

import java.util.UUID;

@EventBusSubscriber(modid = Tracesession.MODID, bus = EventBusSubscriber.Bus.MOD)
public class Config
{
    private static final ModConfigSpec.Builder BUILDER = new ModConfigSpec.Builder();

    private static final ModConfigSpec.ConfigValue<String> BACKEND_URL = BUILDER
            .comment("TraceSession web backend URL (use https:// for SSL)")
            .define("backendUrl", "http://localhost:27890");

    private static final ModConfigSpec.ConfigValue<String> SERVER_ID = BUILDER
            .comment("Unique server identifier (auto-generated if empty)")
            .define("serverId", UUID.randomUUID().toString());

    private static final ModConfigSpec.ConfigValue<String> SERVER_NAME = BUILDER
            .comment("Server display name")
            .define("serverName", "Minecraft Server");

    private static final ModConfigSpec.ConfigValue<String> API_KEY = BUILDER
            .comment("Optional backend API key. Must match TRACESESSION_API_KEY when the backend is accessed remotely.")
            .define("apiKey", "");

    private static final ModConfigSpec.ConfigValue<String> MOD_LOADER = BUILDER
            .comment("Mod loader type identifier")
            .define("modLoader", "NeoForge");

    private static final ModConfigSpec.BooleanValue ENABLE_DEBUG_COMMANDS = BUILDER
            .comment("Enable OP-only TraceSession debug commands that can write test data")
            .define("enableDebugCommands", false);

    private static final ModConfigSpec.IntValue COMMAND_POLL_SECONDS = BUILDER
            .comment("How often the mod checks for queued web terminal commands")
            .defineInRange("commandPollSeconds", 2, 1, 30);

    static final ModConfigSpec SPEC = BUILDER.build();

    public static String backendUrl;
    public static String serverId;
    public static String serverName;
    public static String apiKey;
    public static String modLoader;
    public static boolean enableDebugCommands;
    public static int commandPollSeconds;

    @SubscribeEvent
    static void onLoad(final ModConfigEvent event)
    {
        backendUrl = BACKEND_URL.get();
        serverId = SERVER_ID.get();
        serverName = SERVER_NAME.get();
        apiKey = API_KEY.get();
        modLoader = MOD_LOADER.get();
        enableDebugCommands = ENABLE_DEBUG_COMMANDS.get();
        commandPollSeconds = COMMAND_POLL_SECONDS.get();
    }
}
