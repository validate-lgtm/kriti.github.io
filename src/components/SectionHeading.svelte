<script>
  export let heading,
    subHeading,
    center = true,
    containerClass = "";
</script>

<style>
  .left {
    text-align: left;
  }
</style>

<div class={containerClass}>
  <div class="container-heading bold {!center ? 'left' : ''}">{heading}</div>
  {#if subHeading}
    <div class="center text-grey container-subheading thin xxl-h-padding">
      {@html subHeading}
    </div>
  {/if}
</div>
