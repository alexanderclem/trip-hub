-- Routed drive times in the Guatemalan highlands came back ~40–50% faster than reality
-- (Antigua → Panajachel routed at 80 min; a private car takes ~2–2.5 h). Widen the default
-- correction range for new trips.
alter table public.trips alter column route_factor_low set default 1.4;
alter table public.trips alter column route_factor_high set default 2.0;
