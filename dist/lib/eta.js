"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.haversineKm = haversineKm;
exports.calcEtaIso = calcEtaIso;
function haversineKm(lat1, lon1, lat2, lon2) {
    const toRad = (v) => (v * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function calcEtaIso(lat, lng, destLat, destLng, speedKmh = 50) {
    const km = haversineKm(lat, lng, destLat, destLng);
    const hours = km / speedKmh;
    const ms = hours * 3600 * 1000;
    return new Date(Date.now() + ms).toISOString();
}
