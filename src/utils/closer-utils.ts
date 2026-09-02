import { Closer } from '../types';
import { CONFIG } from '../config/constants';

/** Single source of truth for the closer used by new-booking tools. */
export const getDefaultCloser = (closers: Closer[] = []): Closer => {
    return closers.find((closer) => closer.active && closer.default)
        || closers.find((closer) => closer.active)
        || (CONFIG.DEFAULT_CLOSERS[0] as Closer);
};
