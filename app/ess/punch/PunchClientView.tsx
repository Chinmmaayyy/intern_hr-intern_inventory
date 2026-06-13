'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { recordMobilePunch } from '@/app/actions/attendance-actions';
import { Clock, MapPin, CheckCircle2, XCircle, AlertTriangle, Loader2, Navigation, RefreshCw } from 'lucide-react';

interface PunchClientViewProps {
    employee: any;
    organizationId: string;
    targetLat: number;
    targetLng: number;
    locationName: string;
    radiusMeters: number;
    todayAttendance: any;
}

export function PunchClientView({
    employee,
    organizationId,
    targetLat,
    targetLng,
    locationName,
    radiusMeters,
    todayAttendance
}: PunchClientViewProps) {
    const router = useRouter();

    // Live clock state
    const [currentTime, setCurrentTime] = useState<Date | null>(null);

    // Geolocation states
    const [userLat, setUserLat] = useState<number | null>(null);
    const [userLng, setUserLng] = useState<number | null>(null);
    const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
    const [locError, setLocError] = useState<string | null>(null);
    const [isLocating, setIsLocating] = useState(false);
    const [distance, setDistance] = useState<number | null>(null);

    // Action execution states
    const [punchLoading, setPunchLoading] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const showToast = (type: 'success' | 'error', message: string) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 5000);
    };

    // 1. Live Clock effect
    useEffect(() => {
        setCurrentTime(new Date());
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // 2. Compute Haversine distance
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371000; // Earth radius in meters
        const phi1 = lat1 * Math.PI / 180;
        const phi2 = lat2 * Math.PI / 180;
        const deltaPhi = (lat2 - lat1) * Math.PI / 180;
        const deltaLambda = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
                  Math.cos(phi1) * Math.cos(phi2) *
                  Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // distance in meters
    };

    // 3. Geolocation fetch logic
    const getGeolocation = () => {
        if (typeof window === 'undefined' || !('geolocation' in navigator)) {
            setLocError('Geolocation is not supported by your browser.');
            return;
        }

        setIsLocating(true);
        setLocError(null);

        const optionsHigh = { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 };
        const optionsLow = { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 };

        const onSuccess = (position: GeolocationPosition) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const accuracy = position.coords.accuracy;

            setUserLat(lat);
            setUserLng(lng);
            setGpsAccuracy(accuracy);

            // Compute distance
            const dist = calculateDistance(lat, lng, targetLat, targetLng);
            setDistance(dist);
            setIsLocating(false);
        };

        const onError = (err: GeolocationPositionError, isHighAccuracyAttempt: boolean) => {
            // Log full error details as a string instead of an object to avoid console serialization issues in Next.js dev overlay
            console.error(`GPS error (${isHighAccuracyAttempt ? 'High Accuracy' : 'Low Accuracy'}): code=${err.code}, message=${err.message}`);

            if (isHighAccuracyAttempt) {
                console.warn('High-accuracy GPS request failed or timed out. Retrying with low-accuracy fallback...');
                navigator.geolocation.getCurrentPosition(
                    onSuccess,
                    (lowErr) => onError(lowErr, false),
                    optionsLow
                );
            } else {
                setIsLocating(false);
                switch (err.code) {
                    case err.PERMISSION_DENIED:
                        setLocError('Location permission denied. Please allow location access in your browser settings.');
                        break;
                    case err.POSITION_UNAVAILABLE:
                        setLocError('Location information is unavailable. Check your device GPS settings.');
                        break;
                    case err.TIMEOUT:
                        setLocError('Request to get location timed out. Please try again.');
                        break;
                    default:
                        setLocError('An unknown error occurred while retrieving location.');
                }
            }
        };

        navigator.geolocation.getCurrentPosition(
            onSuccess,
            (highErr) => onError(highErr, true),
            optionsHigh
        );
    };

    // Get geolocation on mount
    useEffect(() => {
        getGeolocation();
    }, [targetLat, targetLng]);

    // 4. Punch execute handler
    const handlePunch = async () => {
        if (userLat === null || userLng === null || distance === null) {
            setActionError('Location status is unknown. Please check your geofence status.');
            return;
        }

        if (distance > radiusMeters) {
            setActionError('Cannot punch: You are outside the authorized office boundary.');
            return;
        }

        setPunchLoading(true);
        setActionError(null);

        try {
            const res = await recordMobilePunch({
                employeeId: employee.id,
                organizationId,
                geoLat: userLat,
                geoLng: userLng,
                branchLat: targetLat,
                branchLng: targetLng,
                branchRadiusMeters: radiusMeters
            });

            if (res.success) {
                showToast('success', 'Punch recorded and attendance processed.');
                router.refresh();
                // Fetch fresh location updates
                getGeolocation();
            } else {
                setActionError(res.error || 'Failed to record punch.');
            }
        } catch (error: any) {
            setActionError(error.message || 'An unexpected error occurred.');
        } finally {
            setPunchLoading(false);
        }
    };

    // Format helpers
    const formatClockTime = (date: Date) => {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    };

    const formatClockDate = (date: Date) => {
        return date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    };

    const formatTimeOnly = (dateStr: string | Date | null) => {
        if (!dateStr) return '--:--';
        const d = new Date(dateStr);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
    };

    // Punch statuses
    const hasPunchedIn = !!todayAttendance?.check_in;
    const hasPunchedOut = !!todayAttendance?.check_out;
    const withinGeofence = distance !== null && distance <= radiusMeters;

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Toast Feedback */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border transition-all text-sm font-semibold ${
                    toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                    {toast.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    <span>{toast.message}</span>
                </div>
            )}

            {/* Title card */}
            <div className="bg-[#1e2a4a] text-white rounded-3xl p-6 shadow-sm flex flex-col items-center text-center relative overflow-hidden">
                {/* Decorative gradients */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/10 rounded-full blur-2xl"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-green-500/10 rounded-full blur-2xl"></div>

                <div className="p-3 bg-white/10 rounded-full text-orange-400 mb-2">
                    <Navigation className="h-6 w-6" />
                </div>
                <h1 className="text-lg font-black uppercase tracking-widest text-white">Geofenced Mobile Punch</h1>
                <p className="text-xs text-slate-300 mt-1 max-w-sm">
                    Punch in or out using your browser's location coordinates. You must be within {radiusMeters} meters of the office location.
                </p>
            </div>

            {/* Clock Container */}
            <div className="bg-white border border-gray-100 shadow-sm rounded-3xl p-6 flex flex-col items-center justify-center space-y-3 relative">
                {currentTime ? (
                    <>
                        <div className="text-3xl sm:text-4xl font-black text-gray-800 tracking-tight flex items-center gap-1">
                            <span className="inline-block w-2.5 h-2.5 bg-orange-500 rounded-full animate-ping mr-2"></span>
                            {formatClockTime(currentTime)}
                        </div>
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                            {formatClockDate(currentTime)}
                        </div>
                    </>
                ) : (
                    <div className="flex items-center justify-center py-6">
                        <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
                    </div>
                )}
            </div>

            {/* Geofence Status Card */}
            <div className="bg-white border border-gray-100 shadow-sm rounded-3xl p-6 space-y-5">
                <div className="flex items-center justify-between">
                    <h3 className="font-extrabold text-xs text-gray-500 uppercase tracking-widest">Geofence Status</h3>
                    <button
                        onClick={getGeolocation}
                        disabled={isLocating}
                        className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500 transition-colors disabled:opacity-50 flex items-center gap-1.5 text-[10px] font-bold"
                    >
                        <RefreshCw className={`h-3 w-3 ${isLocating ? 'animate-spin' : ''}`} />
                        Refresh GPS
                    </button>
                </div>

                <div className="space-y-4">
                    {/* Location target info */}
                    <div className="flex items-start gap-3 p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
                        <MapPin className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Office Target Location</p>
                            <p className="text-sm font-black text-gray-800">{locationName}</p>
                            <p className="text-[10px] font-mono text-gray-500">
                                Coordinates: {targetLat.toFixed(5)}, {targetLng.toFixed(5)} (Limit: {radiusMeters}m)
                            </p>
                        </div>
                    </div>

                    {/* Geolocation evaluation */}
                    {isLocating ? (
                        <div className="flex items-center gap-2 p-4 bg-orange-50/50 border border-orange-100/50 text-orange-700 text-xs rounded-2xl justify-center font-bold">
                            <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
                            <span>Acquiring highly accurate GPS coordinates...</span>
                        </div>
                    ) : locError ? (
                        <div className="p-4 bg-red-50 border border-red-100 text-red-700 text-xs rounded-2xl flex items-start gap-3">
                            <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
                            <div className="space-y-1">
                                <p className="font-black uppercase tracking-wider text-[10px]">Location Detection Error</p>
                                <p className="leading-relaxed font-medium">{locError}</p>
                            </div>
                        </div>
                    ) : userLat !== null && userLng !== null && distance !== null ? (
                        <div className="space-y-3">
                            {/* Distance indicator */}
                            <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                                withinGeofence ? 'bg-green-50 border-green-100 text-green-800' : 'bg-red-50 border-red-100 text-red-800'
                            }`}>
                                <div className="flex items-center gap-3">
                                    {withinGeofence ? (
                                        <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                                    ) : (
                                        <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                                    )}
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">Current Range</p>
                                        <p className="text-sm font-black mt-0.5">
                                            {withinGeofence ? 'Within Office Range' : 'Outside Office Range'}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">Distance</p>
                                    <p className="text-base font-black mt-0.5">
                                        {distance < 1 ? 'Under 1 meter' : `${Math.round(distance)} meters`}
                                    </p>
                                </div>
                            </div>

                            {/* GPS details info */}
                            <p className="text-[9px] font-medium text-gray-400 text-center">
                                Detected Location: {userLat.toFixed(5)}, {userLng.toFixed(5)} (Accuracy: {gpsAccuracy ? `${Math.round(gpsAccuracy)}m` : 'N/A'})
                            </p>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center p-6 text-gray-400 text-xs font-bold">
                            Location not checked. Click "Refresh GPS" to acquire.
                        </div>
                    )}
                </div>
            </div>

            {/* Punch Trigger Card */}
            <div className="bg-white border border-gray-100 shadow-sm rounded-3xl p-6 flex flex-col items-center space-y-4">
                {actionError && (
                    <div className="w-full p-3.5 bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl flex items-center gap-2">
                        <XCircle className="h-4 w-4 shrink-0 text-red-500" />
                        <span className="font-semibold">{actionError}</span>
                    </div>
                )}

                {/* Status summary of today */}
                <div className="w-full grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-2xl flex flex-col items-center">
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">In Punch</span>
                        <span className="text-sm font-black text-gray-800 mt-1">{formatTimeOnly(todayAttendance?.check_in)}</span>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-2xl flex flex-col items-center">
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Out Punch</span>
                        <span className="text-sm font-black text-gray-800 mt-1">{formatTimeOnly(todayAttendance?.check_out)}</span>
                    </div>
                </div>

                {/* Big punch button */}
                <button
                    onClick={handlePunch}
                    disabled={punchLoading || isLocating || !withinGeofence || hasPunchedOut}
                    className="w-full py-4 text-sm font-black tracking-widest text-white rounded-2xl hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed uppercase"
                    style={{ background: 'linear-gradient(to right, #f97316, #16a34a)' }}
                >
                    {punchLoading ? (
                        <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Recording Punch...
                        </>
                    ) : hasPunchedOut ? (
                        'Checked Out for Today'
                    ) : hasPunchedIn ? (
                        'Record Check-Out'
                    ) : (
                        'Record Check-In'
                    )}
                </button>

                {!withinGeofence && !isLocating && (
                    <p className="text-[10px] text-red-500 font-bold text-center">
                        ⚠ You must enter the 500m geofence area to record a punch.
                    </p>
                )}
            </div>
        </div>
    );
}
