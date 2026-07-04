/**
 * Fixed geofence anchor for the department, surveyed via Admin → Geofence designer.
 * Every session uses this instead of capturing the teacher's live GPS — removes
 * dependency on the teacher's device/GPS accuracy at the moment they open a session,
 * and eliminates the "geofence inactive" case entirely (every session always has one).
 */
export const CAMPUS_LAT = 22.572532;
export const CAMPUS_LNG = 88.437350;
export const CAMPUS_RADIUS_M = 20;
