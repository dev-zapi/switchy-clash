<script lang="ts">
  import Skeleton from './Skeleton.svelte';
</script>

<div class="bg-[var(--color-bg-secondary)] rounded-md px-2.5 py-2 shadow-md">
  <!-- Speed Test Button Placeholder -->
  <div class="absolute top-1.5 right-1.5 text-xs p-0.5">
    <Skeleton variant="circular" width="16px" height="16px" />
  </div>

  <!-- Group Name -->
  <div class="pr-5">
    <Skeleton variant="text" width="80%" />
  </div>
  
  <!-- Type + Node Count -->
  <div class="mt-1.5">
    <Skeleton variant="text" width="60%" />
  </div>
  
  <!-- Current Node + Latency -->
  <div class="mt-1.5 flex items-center justify-between">
    <Skeleton variant="text" width="70%" />
    <Skeleton variant="text" width="30px" />
  </div>
</div>
