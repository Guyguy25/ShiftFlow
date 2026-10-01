export const plural = (count, singular, multiple = `${singular}s`) => Number(count) > 1 ? multiple : singular;
export const counted = (count, singular, multiple) => `${Number(count) || 0} ${plural(count, singular, multiple)}`;
