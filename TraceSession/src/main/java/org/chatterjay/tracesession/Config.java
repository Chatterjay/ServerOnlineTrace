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
            .define("backendUrl", "https://localhost:4561");

    private static final ModConfigSpec.ConfigValue<String> SERVER_ID = BUILDER
            .comment("Unique server identifier (auto-generated if empty)")
            .define("serverId", UUID.randomUUID().toString());

    private static final ModConfigSpec.ConfigValue<String> SERVER_NAME = BUILDER
            .comment("Server display name")
            .define("serverName", "Minecraft Server");

    private static final ModConfigSpec.ConfigValue<String> MOD_LOADER = BUILDER
            .comment("Mod loader type identifier")
            .define("modLoader", "NeoForge");

    static final ModConfigSpec SPEC = BUILDER.build();

    public static String backendUrl;
    public static String serverId;
    public static String serverName;
    public static String modLoader;

    @SubscribeEvent
    static void onLoad(final ModConfigEvent event)
    {
        backendUrl = BACKEND_URL.get();
        serverId = SERVER_ID.get();
        serverName = SERVER_NAME.get();
        modLoader = MOD_LOADER.get();
    }
}
