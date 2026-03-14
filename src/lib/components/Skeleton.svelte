<script lang="ts">
  let {
    variant = 'text',
    width,
    height,
    borderRadius = 'md'
  }: {
    variant?: 'text' | 'circular' | 'rectangular';
    width?: string;
    height?: string;
    borderRadius?: 'none' | 'sm' | 'md' | 'lg' | 'full';
  } = $props();

  const baseStyles = 'animate-pulse bg-[var(--color-bg-tertiary)]';

  const borderRadiusStyles = {
    none: 'rounded-none',
    sm: 'rounded',
    md: 'rounded-md',
    lg: 'rounded-lg',
    full: 'rounded-full'
  };

  const variantStyles = $derived.by(() => {
    switch (variant) {
      case 'circular':
        return 'rounded-full';
      case 'rectangular':
        return borderRadiusStyles[borderRadius];
      case 'text':
      default:
        return `h-4 ${borderRadiusStyles[borderRadius]}`;
    }
  });

  const computedStyles = $derived(`${baseStyles} ${variantStyles} ${width ? `w-[${width}]` : ''} ${height ? `h-[${height}]` : ''}`);
</script>

<div class={computedStyles}></div>
