function normalizePreset(value, defaultPreset) {
    const v = value?.trim();
    if (v === "24h" || v === "7d" || v === "30d" || v === "90d" || v === "all") {
        return v;
    }
    return defaultPreset;
}
/**
 * List endpoints: optional `from` / `to` (ISO) override `range` preset.
 * `defaultPreset` when `range` is omitted (errors/events: all; sessions: 24h).
 */
export function parseCreatedRange(query, defaultPreset) {
    const fromRaw = query.from?.trim();
    const toRaw = query.to?.trim();
    if (fromRaw || toRaw) {
        const gte = fromRaw ? new Date(fromRaw) : undefined;
        const lte = toRaw ? endOfDayIfDateOnly(toRaw) : undefined;
        const out = {};
        if (gte && !Number.isNaN(gte.getTime()))
            out.gte = gte;
        if (lte && !Number.isNaN(lte.getTime()))
            out.lte = lte;
        return out;
    }
    const preset = normalizePreset(query.range, defaultPreset);
    if (preset === "all")
        return {};
    const hours = preset === "7d"
        ? 7 * 24
        : preset === "30d"
            ? 30 * 24
            : preset === "90d"
                ? 90 * 24
                : 24;
    return { gte: new Date(Date.now() - hours * 60 * 60 * 1000) };
}
/** If value is YYYY-MM-DD only, use end of that local day as UTC-ish end (parse as UTC date end). */
function endOfDayIfDateOnly(iso) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
        return new Date(`${iso}T23:59:59.999Z`);
    }
    return new Date(iso);
}
export function escapeLikePattern(user) {
    return user.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}
