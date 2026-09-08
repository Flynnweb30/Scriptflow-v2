import React, { useState, useRef, useCallback, memo, ReactNode } from 'react';

interface VirtualListProps<T> {
    /** Array of items to render */
    items: T[];
    /** Function to render each item */
    renderItem: (item: T, index: number) => ReactNode;
    /** Height of each item in pixels */
    itemHeight: number;
    /** Height of the container in pixels */
    containerHeight: number;
    /** Number of items to render outside the visible area (for smoother scrolling) */
    overscan?: number;
    /** Key extractor function for React keys */
    keyExtractor?: (item: T, index: number) => string;
    /** Additional class name for the container */
    className?: string;
    /** Additional styles for the container */
    style?: React.CSSProperties;
}

export function VirtualList<T>({
    items,
    renderItem,
    itemHeight,
    containerHeight,
    overscan = 3,
    keyExtractor,
    className = '',
    style = {}
}: VirtualListProps<T>) {
    const [scrollTop, setScrollTop] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const totalHeight = items.length * itemHeight;

    // Calculate the visible range
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
        items.length,
        Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );

    const visibleItems = items.slice(startIndex, endIndex);
    const offsetY = startIndex * itemHeight;

    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        setScrollTop(e.currentTarget.scrollTop);
    }, []);

    // Scroll to a specific index
    const scrollToIndex = useCallback((index: number) => {
        if (containerRef.current) {
            containerRef.current.scrollTop = index * itemHeight;
        }
    }, [itemHeight]);

    // Get the current visible range
    const getVisibleRange = useCallback(() => {
        return { startIndex, endIndex };
    }, [startIndex, endIndex]);

    // Default key extractor
    const getKey = (item: T, index: number): string => {
        if (keyExtractor) {
            return keyExtractor(item, index);
        }
        return `virtual-item-${index}`;
    };

    return (
        <div
            ref={containerRef}
            onScroll={handleScroll}
            className={`virtual-list-container ${className}`}
            style={{
                height: containerHeight,
                overflow: 'auto',
                position: 'relative',
                willChange: 'transform',
                scrollbarWidth: 'thin',
                ...style
            }}
        >
            <div
                className="virtual-list-inner"
                style={{
                    height: totalHeight,
                    position: 'relative',
                    width: '100%'
                }}
            >
                <div
                    className="virtual-list-visible"
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        transform: `translateY(${offsetY}px)`,
                        willChange: 'transform'
                    }}
                >
                    {visibleItems.map((item, index) => (
                        <div
                            key={getKey(item, startIndex + index)}
                            className="virtual-list-item"
                            style={{
                                height: itemHeight,
                                width: '100%',
                                boxSizing: 'border-box'
                            }}
                        >
                            {renderItem(item, startIndex + index)}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// Memoized version of VirtualList for better performance
export const MemoizedVirtualList = memo(VirtualList) as typeof VirtualList;

export default VirtualList;