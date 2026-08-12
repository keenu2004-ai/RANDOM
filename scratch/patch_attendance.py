import re

file_path = r"c:\Users\Vaibhav\antigravity\New folder\theiakshi-enterprise\src\components\attendance\AttendanceView.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add pagination states
state_to_add = """
  // Pagination State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
"""

content = content.replace(
    "  // Workforce Attendance State (Admin/Manager)",
    state_to_add + "\n  // Workforce Attendance State (Admin/Manager)"
)

# 2. Update loadInitialData for myAttendance pagination
old_my_att = "hrmsApi.getAttendance({ month: String(selectedMonth), year: String(selectedYear) })"
new_my_att = "hrmsApi.getAttendance({ month: String(selectedMonth), year: String(selectedYear), page: String(page), limit: String(limit), sortBy, sortOrder })"
content = content.replace(old_my_att, new_my_att)

# 3. Handle data structure in loadInitialData
old_set_my = "setMyAttendance(myAttRes);"
new_set_my = """      setMyAttendance(myAttRes.data || myAttRes);
      if (myAttRes.pagination) {
        setTotal(myAttRes.pagination.total);
        setTotalPages(myAttRes.pagination.totalPages);
      }"""
content = content.replace(old_set_my, new_set_my)

# 4. Update loadWorkforceData for workforceAttendance pagination
old_params = "const params: Record<string, string> = { date: filterDate };"
new_params = """const params: Record<string, string> = { 
        date: filterDate,
        page: String(page),
        limit: String(limit),
        sortBy,
        sortOrder
      };"""
content = content.replace(old_params, new_params)

# 5. Handle data structure in loadWorkforceData
old_set_workforce = "setWorkforceAttendance(attRes);"
new_set_workforce = """      setWorkforceAttendance(attRes.data || attRes);
      if (attRes.pagination) {
        setTotal(attRes.pagination.total);
        setTotalPages(attRes.pagination.totalPages);
      }"""
content = content.replace(old_set_workforce, new_set_workforce)

# 6. Add effect dependency for pagination
old_effect = "}, [activeTab, filterDate, filterDepartment, filterStatus]);"
new_effect = "}, [activeTab, filterDate, filterDepartment, filterStatus, page, limit, sortBy, sortOrder]);"
content = content.replace(old_effect, new_effect)

# 7. Add effect dependency for my attendance pagination
content = content.replace(
    "}, []);",
    "}, [page, limit, sortBy, sortOrder, selectedMonth, selectedYear]);"
)

# 8. Update check-in and check-out handlers
old_checkin = """  const handleCheckIn = async () => {
    if (!currentCoords) {
      alert('Requesting GPS position... Please allow browser location access.');
      requestLocation();
      return;
    }

    setError(null);
    setSuccessMsg(null);
    setActionLoading(true);

    try {
      const res = await hrmsApi.checkIn({
        latitude: currentCoords.latitude,
        longitude: currentCoords.longitude,
        address: `Geofenced Location (${currentCoords.latitude.toFixed(4)}, ${currentCoords.longitude.toFixed(4)})`
      });
      setSuccessMsg('Check-In successful! Attendance recorded in database and synchronized.');
      loadInitialData();
    } catch (err: any) {
      setError(err.message || 'Check-In failed');
    } finally {
      setActionLoading(false);
    }
  };"""

new_checkin = """  const handleCheckIn = async () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser or device.');
      return;
    }

    setError(null);
    setSuccessMsg(null);
    setActionLoading(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude, accuracy } = pos.coords;
          await hrmsApi.checkIn({
            latitude,
            longitude,
            accuracy,
            address: `Geofenced Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`
          });
          setSuccessMsg('Check-In successful! Attendance recorded in database and synchronized.');
          await loadInitialData();
        } catch (err: any) {
          setError(err.message || 'Check-In failed');
        } finally {
          setActionLoading(false);
        }
      },
      (err) => {
        setActionLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setError('Location access permission was denied. Location permission is required when mandatory attendance location is enabled. Please allow location access in your browser site settings and try again.');
        } else if (err.code === err.TIMEOUT) {
          setError('Location request timed out. Please try again.');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setError('Location information is unavailable.');
        } else {
          setError('Unable to retrieve current location fix: ' + err.message);
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };"""
content = content.replace(old_checkin, new_checkin)

old_checkout = """  const handleCheckOut = async () => {
    if (!currentCoords) {
      requestLocation();
      return;
    }

    setError(null);
    setSuccessMsg(null);
    setActionLoading(true);

    try {
      const res = await hrmsApi.checkOut({
        latitude: currentCoords.latitude,
        longitude: currentCoords.longitude,
        address: `Check-out Location (${currentCoords.latitude.toFixed(4)}, ${currentCoords.longitude.toFixed(4)})`
      });
      setSuccessMsg('Check-Out successful! Net working hours calculated and saved.');
      loadInitialData();
    } catch (err: any) {
      setError(err.message || 'Check-Out failed');
    } finally {
      setActionLoading(false);
    }
  };"""

new_checkout = """  const handleCheckOut = async () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser or device.');
      return;
    }

    setError(null);
    setSuccessMsg(null);
    setActionLoading(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude, accuracy } = pos.coords;
          await hrmsApi.checkOut({
            latitude,
            longitude,
            accuracy,
            address: `Check-out Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`
          });
          setSuccessMsg('Check-Out successful! Net working hours calculated and saved.');
          await loadInitialData();
        } catch (err: any) {
          setError(err.message || 'Check-Out failed');
        } finally {
          setActionLoading(false);
        }
      },
      (err) => {
        setActionLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setError('Location access permission was denied. Location permission is required when mandatory attendance location is enabled. Please allow location access in your browser site settings and try again.');
        } else if (err.code === err.TIMEOUT) {
          setError('Location request timed out. Please try again.');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setError('Location information is unavailable.');
        } else {
          setError('Unable to retrieve current location fix: ' + err.message);
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };"""
content = content.replace(old_checkout, new_checkout)


with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("Updated AttendanceView.tsx")
