<template>
  <div
    ref="cardRef"
    class="relative overflow-hidden rounded-xl"
    :class="[hoverClass, cardClass]"
    @mousemove="onMouseMove"
    @mouseleave="onMouseLeave"
  >
    <div
      class="pointer-events-none absolute inset-0 -z-0 transition-opacity duration-500 ease-out"
      :class="glowVisible ? 'opacity-100' : 'opacity-0'"
      :style="glowStyle"
    />
    <div class="relative z-[1]">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";

const props = withDefaults(defineProps<{
  cardClass?: string;
  hoverClass?: string;
}>(), {
  cardClass: "card card-hover",
  hoverClass: "",
});

const cardRef = ref<HTMLElement | null>(null);
const mouseX = ref(0);
const mouseY = ref(0);
const glowVisible = ref(false);

function onMouseMove(e: MouseEvent) {
  if (!cardRef.value) return;
  const rect = cardRef.value.getBoundingClientRect();
  mouseX.value = e.clientX - rect.left;
  mouseY.value = e.clientY - rect.top;
  glowVisible.value = true;
}

function onMouseLeave() {
  glowVisible.value = false;
}

const glowStyle = computed(() => ({
  background: `radial-gradient(500px circle at ${mouseX.value}px ${mouseY.value}px, rgba(251, 191, 36, 0.06), transparent 60%)`,
}));
</script>
