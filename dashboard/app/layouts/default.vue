<template>
  <div class="dashboard-shell">
    <slot />
  </div>
</template>

<style scoped>
.dashboard-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
</style>
