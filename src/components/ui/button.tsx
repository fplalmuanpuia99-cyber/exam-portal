import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'ghost' | 'destructive' | 'outline';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'default',
      size = 'default',
      asChild = false,
      children,
      ...props
    },
    ref
  ) => {
    const classes = cn(
      'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
      {
        'bg-primary text-primary-foreground hover:opacity-90':
          variant === 'default',
        'bg-muted text-foreground hover:bg-muted/80': variant === 'secondary',
        'hover:bg-muted hover:text-foreground': variant === 'ghost',
        'bg-red-600 text-white hover:bg-red-700': variant === 'destructive',
        'border border-border bg-transparent hover:bg-muted':
          variant === 'outline',
      },
      {
        'h-10 px-4 py-2': size === 'default',
        'h-8 rounded-md px-3 text-xs': size === 'sm',
        'h-11 rounded-md px-8': size === 'lg',
        'h-10 w-10': size === 'icon',
      },
      className
    );

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<any>, {
        className: cn(classes, (children as any).props?.className),
        ref,
        ...props,
      });
    }

    return (
      <button className={classes} ref={ref} {...props}>
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

export { Button };
