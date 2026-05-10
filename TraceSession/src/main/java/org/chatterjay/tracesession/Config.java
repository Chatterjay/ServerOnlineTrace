package org.chatterjay.tracesession;

import net.minecraftforge.common.ForgeConfigSpec;
import net.minecraftforge.eventbus.api.SubscribeEvent;
import net.minecraftforge.fml.common.Mod;
import net.minecraftforge.fml.event.config.ModConfigEvent;

import java.util.UUID;

@Mod.EventBusSubscriber(modid = Tracesession.MODID, bus = Mod.EventBusSubscriber.Bus.MOD)
public class Config
{
    private static final ForgeConfigSpec.Builder BUILDER = new ForgeConfigSpec.Builder();

    private static final ForgeConfigSpec.ConfigValue<String> BACKEND_URL = BUILDER
            .comment("TraceSession web backend URL (use https:// for SSL)")
            .define("backendUrl", "http://localhost:27890");

    private static final ForgeConfigSpec.ConfigValue<String> SERVER_ID = BUILDER
            .comment("Unique server identifier (auto-generated if empty)")
            .define("serverId", UUID.randomUUID().toString());

    private static final ForgeConfigSpec.ConfigValue<String> SERVER_NAME = BUILDER
            .comment("Server display name")
            .define("serverName", "Minecraft Server");

    private static final ForgeConfigSpec.ConfigValue<String> MOD_LOADER = BUILDER
            .comment("Mod loader type identifier")
            .define("modLoader", "Forge");

    static final ForgeConfigSpec SPEC = BUILDER.build();

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
