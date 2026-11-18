import type { SVGProps } from "react";

export const LogoIcon = ({className,onClick}: SVGProps<SVGSVGElement>) => {
    return (
        <svg
            width="47"
            height="47"
            viewBox="0 0 47 47"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            onClick={onClick}
        >
            <rect
                x="3.76013"
                y="5.42212"
                width="40"
                height="40"
                rx="10"
                fill="currentColor"
            />
            <path
                d="M38.2126 11.9221L13.3571 16.1416C12.2947 16.322 12.2299 17.8242 13.2729 18.0953L30.57 22.5926C31.527 22.8414 31.5808 24.1801 30.6469 24.5049L24.5551 26.6238C23.7116 26.9172 23.6465 28.0851 24.4522 28.4704L31.3794 31.7834C32.2099 32.1806 32.1078 33.3941 31.2226 33.6471L12.7602 38.922"
                stroke="currentColor"
                className="text-orange-500"
                strokeWidth="4"
            />
        </svg>
    )
}