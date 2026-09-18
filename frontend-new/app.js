/* ==========================================================================
   AURA CARE PREDICTOR - FRONTEND LOGIC & DATA ENGINE
   ========================================================================== */

// --- Global Application State ---
const state = {
  activeTab: 'dashboard',
  appointments: [],
  filteredAppointments: [],
  waitlistCandidates: [],
  activeSlot: {
    specialty: 'Cardiology',
    date: '24 Sep 2026',
    time: '10:30 AM',
    status: 'AVAILABLE'
  },
  pendingReplacementSlot: null,
  selectedAppointment: null,
  selectedCandidate: null,
  selectedFile: null,
  parsedRecords: [],
  demoStep: 0,
  isBackendConnected: false,
  donutChartInstance: null
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initDrawer();
  initFilters();
  initUploadFeature();
  initReplacementBanners();
  initDemoController();
  
  // Fetch live backend predictions
  loadData();

  document.getElementById('btnRefreshData')?.addEventListener('click', loadData);
  document.getElementById('btnSimulateSlot')?.addEventListener('click', () => {
    alert("Slot state updated: Cardiology 10:30 AM remains open for waitlist backfill.");
  });
});

// --- API Data Loader (Protected ML Integration) ---
async function loadData() {
  const errorBanner = document.getElementById('serviceErrorBanner');
  const statusPill = document.getElementById('backendStatusPill');

  try {
    const resHealth = await fetch('/api/health');
    if (resHealth.ok) {
      state.isBackendConnected = true;
      if (statusPill) {
        statusPill.innerHTML = `
          <span class="status-dot"></span>
          <span>ML Engine Active</span>
        `;
        statusPill.style.background = '#ECFDF5';
        statusPill.style.color = '#047857';
        statusPill.style.borderColor = '#A7F3D0';
      }
      if (errorBanner) errorBanner.style.display = 'none';

      // Fetch appointments with ML predictions
      const resAppts = await fetch('/api/appointments/upcoming');
      const dataAppts = await resAppts.json();
      state.appointments = dataAppts.appointments || [];

      // Fetch waitlist recommendations
      const resWaitlist = await fetch('/api/waitlist/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ specialty: 'Cardiology' })
      });
      const dataWaitlist = await resWaitlist.json();
      state.waitlistCandidates = dataWaitlist.recommended_candidates || [];

    } else {
      throw new Error("API returned non-200 response");
    }
  } catch (err) {
    console.warn("Prediction service unavailable:", err);
    state.isBackendConnected = false;

    if (statusPill) {
      statusPill.innerHTML = `
        <span class="status-dot" style="background: #EF4444;"></span>
        <span>Prediction service unavailable</span>
      `;
      statusPill.style.background = '#FEF2F2';
      statusPill.style.color = '#991B1B';
      statusPill.style.borderColor = '#FCA5A5';
    }

    if (errorBanner) errorBanner.style.display = 'flex';
  }

  state.filteredAppointments = [...state.appointments];

  renderDashboard();
  renderAppointmentsTable();
  renderWaitlist();
}

// --- Navigation Tab Switcher ---
function initNav() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tab = item.getAttribute('data-tab');
      switchTab(tab);
    });
  });
}

function switchTab(tabId) {
  state.activeTab = tabId;
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
  });
  document.querySelectorAll('.page-view').forEach(view => {
    view.classList.toggle('active', view.id === `view-${tabId}`);
  });

  if (tabId === 'dashboard') {
    renderDashboard();
  } else if (tabId === 'appointments') {
    renderAppointmentsTable();
  } else if (tabId === 'waitlist') {
    renderWaitlist();
  }
}

// --- Dashboard View Renderer ---
function renderDashboard() {
  if (!state.appointments.length) {
    document.getElementById('kpiUpcoming').innerText = "0";
    document.getElementById('kpiHighRisk').innerText = "0";
    document.getElementById('kpiReminderPriority').innerText = "0";
    document.getElementById('kpiWaitlist').innerText = state.waitlistCandidates.length || "0";
    document.getElementById('lblHighRiskCount').innerText = "0";
    document.getElementById('lblMedRiskCount').innerText = "0";
    document.getElementById('lblLowRiskCount').innerText = "0";
    document.getElementById('donutTotal').innerText = "0";
    document.getElementById('dashboardAttentionBody').innerHTML = `
      <tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">
        No active appointments currently loaded.
      </td></tr>
    `;
    renderDonutChart(0, 0, 0);
    return;
  }

  const highRisk = state.appointments.filter(a => a.noshow_probability >= 0.60);
  const medRisk = state.appointments.filter(a => a.noshow_probability >= 0.40 && a.noshow_probability < 0.60);
  const lowRisk = state.appointments.filter(a => a.noshow_probability < 0.40);

  document.getElementById('lblLowRiskCount').innerText = lowRisk.length;
  document.getElementById('lblMedRiskCount').innerText = medRisk.length;
  document.getElementById('lblHighRiskCount').innerText = highRisk.length;
  document.getElementById('donutTotal').innerText = state.appointments.length;

  document.getElementById('kpiUpcoming').innerText = state.appointments.length;
  document.getElementById('kpiHighRisk').innerText = highRisk.length;
  document.getElementById('kpiReminderPriority').innerText = highRisk.filter(a => a.reminder_status !== 'Confirmed').length;
  document.getElementById('kpiWaitlist').innerText = state.waitlistCandidates.length;

  renderDonutChart(lowRisk.length, medRisk.length, highRisk.length);

  // Render Appointments Requiring Attention Table
  const tbody = document.getElementById('dashboardAttentionBody');
  tbody.innerHTML = '';

  const attentionList = [...highRisk, ...medRisk].slice(0, 5);

  if (!attentionList.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No high-risk appointments currently flagged.</td></tr>`;
    return;
  }

  attentionList.forEach(apt => {
    const tr = document.createElement('tr');
    if (apt.is_empty_slot) {
      tr.innerHTML = `
        <td><strong>${apt.appointment_id}</strong></td>
        <td><strong style="color: var(--text-muted); font-style: italic;">Empty Slot</strong><br><small style="color: var(--text-muted);">${apt.specialty}</small></td>
        <td>${apt.date} at ${apt.time}</td>
        <td>-</td>
        <td><span class="badge badge-blue">AVAILABLE</span></td>
        <td>
          <button class="btn btn-primary btn-sm btn-find-match" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;"><i class="ph-bold ph-magnifying-glass"></i> Find Match</button>
        </td>
      `;
      tr.querySelector('.btn-find-match').addEventListener('click', (e) => {
        e.stopPropagation();
        state.activeSlot = { appointment_id: apt.appointment_id, specialty: apt.specialty, date: apt.date, time: apt.time, status: 'AVAILABLE' };
        switchTab('waitlist');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    } else {
      tr.innerHTML = `
        <td><strong>${apt.appointment_id}</strong></td>
        <td><strong>${apt.patient_name}</strong><br><small style="color: var(--text-muted);">${apt.specialty}</small></td>
        <td>${apt.date} at ${apt.time}</td>
        <td><strong style="color: ${apt.risk_level === 'HIGH' ? 'var(--risk-high-text)' : 'var(--risk-med-text)'}">${Math.round(apt.noshow_probability * 100)}%</strong></td>
        <td><span class="badge ${apt.risk_level === 'HIGH' ? 'badge-high' : 'badge-medium'}">${apt.risk_level}</span></td>
        <td>
          <button class="btn btn-secondary btn-sm btn-inspect" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;">Inspect</button>
        </td>
      `;
      tr.querySelector('.btn-inspect').addEventListener('click', (e) => {
        e.stopPropagation();
        openAppointmentDrawer(apt);
      });
      tr.addEventListener('click', () => openAppointmentDrawer(apt));
    }
    tbody.appendChild(tr);
  });
}

// --- Chart.js Donut Chart Renderer ---
function renderDonutChart(low, med, high) {
  const ctx = document.getElementById('riskDonutChart').getContext('2d');
  
  if (state.donutChartInstance) {
    state.donutChartInstance.destroy();
  }

  state.donutChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Low Risk', 'Medium Risk', 'High Risk'],
      datasets: [{
        data: [low || (med || high ? 0 : 1), med || 0, high || 0],
        backgroundColor: ['#059669', '#F59E0B', '#DC2626'],
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      cutout: '76%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              return ` ${context.label}: ${context.raw} appointments`;
            }
          }
        }
      },
      responsive: true,
      maintainAspectRatio: false
    }
  });
}

// --- Appointments Table Controls & Filter ---
function initFilters() {
  document.getElementById('searchInput')?.addEventListener('input', applyFilters);
  document.getElementById('filterSpecialty')?.addEventListener('change', applyFilters);
  document.getElementById('filterRisk')?.addEventListener('change', applyFilters);
  document.getElementById('sortControl')?.addEventListener('change', applyFilters);
}

function applyFilters() {
  const query = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const specialty = document.getElementById('filterSpecialty')?.value || 'ALL';
  const risk = document.getElementById('filterRisk')?.value || 'ALL';
  const sort = document.getElementById('sortControl')?.value || 'prob-desc';

  let result = state.appointments.filter(apt => {
    const matchQuery = apt.appointment_id.toLowerCase().includes(query) ||
                       apt.patient_name.toLowerCase().includes(query) ||
                       apt.specialty.toLowerCase().includes(query);
    const matchSpec = specialty === 'ALL' || apt.specialty === specialty;
    const matchRisk = risk === 'ALL' || apt.risk_level === risk;
    return matchQuery && matchSpec && matchRisk;
  });

  if (sort === 'prob-desc') {
    result.sort((a, b) => b.noshow_probability - a.noshow_probability);
  } else if (sort === 'prob-asc') {
    result.sort((a, b) => a.noshow_probability - b.noshow_probability);
  }

  state.filteredAppointments = result;
  renderAppointmentsTable();
}

function renderAppointmentsTable() {
  const tbody = document.getElementById('fullAppointmentsBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!state.filteredAppointments.length) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-muted); padding: 2rem;">No matching appointments found.</td></tr>`;
    return;
  }

  state.filteredAppointments.forEach(apt => {
    const tr = document.createElement('tr');
    
    if (apt.is_empty_slot) {
      tr.innerHTML = `
        <td><strong>${apt.appointment_id}</strong></td>
        <td><strong style="color: var(--text-muted); font-style: italic;">Empty Slot</strong></td>
        <td>${apt.specialty}</td>
        <td>${apt.date}<br><small style="color: var(--text-muted);">${apt.time}</small></td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
        <td><span class="badge badge-blue">AVAILABLE</span></td>
        <td style="white-space: nowrap;">
          <button class="btn btn-primary btn-sm btn-find-match"><i class="ph-bold ph-magnifying-glass"></i> Find Match</button>
        </td>
      `;
      tr.querySelector('.btn-find-match').addEventListener('click', (e) => {
        e.stopPropagation();
        state.activeSlot = { appointment_id: apt.appointment_id, specialty: apt.specialty, date: apt.date, time: apt.time, status: 'AVAILABLE' };
        switchTab('waitlist');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    } else {
      let badgeClass = 'badge-low';
      if (apt.risk_level === 'HIGH') badgeClass = 'badge-high';
      if (apt.risk_level === 'MEDIUM') badgeClass = 'badge-medium';

      tr.innerHTML = `
        <td><strong>${apt.appointment_id}</strong></td>
        <td><strong>${apt.patient_name}</strong></td>
        <td>${apt.specialty}</td>
        <td>${apt.date}<br><small style="color: var(--text-muted);">${apt.time}</small></td>
        <td>${apt.lead_time_days} days</td>
        <td>${apt.previous_noshows}</td>
        <td><span style="font-size: 0.8rem; font-weight: 500;">${apt.reminder_status}</span></td>
        <td><strong style="font-size: 0.95rem;">${Math.round(apt.noshow_probability * 100)}%</strong></td>
        <td><span class="badge ${badgeClass}">${apt.risk_level}</span></td>
        <td style="white-space: nowrap;">
          <button class="btn btn-secondary btn-sm btn-inspect" style="margin-right: 0.3rem;">Inspect</button>
          <button class="btn-cancel-appt">Cancel</button>
        </td>
      `;

      tr.querySelector('.btn-inspect').addEventListener('click', (e) => {
        e.stopPropagation();
        openAppointmentDrawer(apt);
      });

      tr.querySelector('.btn-cancel-appt').addEventListener('click', (e) => {
        e.stopPropagation();
        cancelAppointment(apt.appointment_id);
      });

      tr.addEventListener('click', () => openAppointmentDrawer(apt));
    }
    tbody.appendChild(tr);
  });
}

// --- Cancel Appointment Workflow ---
async function cancelAppointment(aptId) {
  const apt = state.appointments.find(a => a.appointment_id === aptId);
  if (!apt) return;

  const confirmCancel = confirm(`Are you sure you want to cancel appointment ${apt.appointment_id} for ${apt.patient_name}?`);
  if (!confirmCancel) return;

  // Preserve slot information for replacement
  state.pendingReplacementSlot = {
    appointment_id: apt.appointment_id,
    original_patient: apt.patient_name,
    specialty: apt.specialty,
    date: apt.date,
    time: apt.time
  };

  // Mark as empty slot instead of removing
  apt.is_empty_slot = true;
  apt.original_patient_name = apt.patient_name;
  apt.patient_name = "Empty Slot";
  // Keep it in the lists to maintain position

  // Send API cancellation if connected
  if (state.isBackendConnected) {
    try {
      await fetch('/api/appointments/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointment_id: aptId })
      });
    } catch (err) {
      console.warn("Backend cancel sync failed:", err);
    }
  }

  // Display replacement banner
  const banner = document.getElementById('cancelledSlotBanner');
  const title = document.getElementById('cancelledSlotTitle');
  if (banner && title) {
    title.innerText = `Slot Cancelled: ${apt.specialty} — ${apt.date} at ${apt.time} (${apt.patient_name})`;
    banner.style.display = 'flex';
  }

  // Close drawer if open
  closeAppointmentDrawer();

  // Refresh UI
  renderDashboard();
  renderAppointmentsTable();
}

function initReplacementBanners() {
  document.getElementById('btnGoToWaitlistForReplacement')?.addEventListener('click', () => {
    switchTab('waitlist');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  document.getElementById('btnViewAppointmentsAfterAssign')?.addEventListener('click', () => {
    switchTab('appointments');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// --- Appointment Detail Side Drawer (LIGHT THEMED) ---
function initDrawer() {
  document.getElementById('btnCloseDrawer')?.addEventListener('click', closeAppointmentDrawer);
  document.getElementById('drawerBackdrop')?.addEventListener('click', (e) => {
    if (e.target.id === 'drawerBackdrop') closeAppointmentDrawer();
  });
}

function openAppointmentDrawer(apt) {
  state.selectedAppointment = apt;
  document.getElementById('drawerApptId').innerText = apt.appointment_id;
  document.getElementById('drawerPatientName').innerText = apt.patient_name;

  const body = document.getElementById('drawerBody');
  const probPct = Math.round(apt.noshow_probability * 100);

  let badgeClass = 'badge-low';
  if (apt.risk_level === 'HIGH') badgeClass = 'badge-high';
  if (apt.risk_level === 'MEDIUM') badgeClass = 'badge-medium';

  const factorsHtml = (apt.factors || [
    { factor: "Previous no-shows", value: `${apt.previous_noshows} previous`, impact: "High Increase" },
    { factor: "Booking lead time", value: `${apt.lead_time_days} days`, impact: "Moderate Increase" },
    { factor: "Reminder status", value: apt.reminder_status, impact: "High Increase" }
  ]).map(f => {
    let fillWidth = 70;
    let fillClass = 'high';
    if (f.impact?.includes('Moderate')) { fillWidth = 50; fillClass = 'medium'; }
    if (f.impact?.includes('Decrease')) { fillWidth = 25; fillClass = 'low'; }

    return `
      <div style="background: #F8FAFC; border: 1px solid #E2E8F0; padding: 0.85rem; border-radius: 10px; margin-bottom: 0.75rem;">
        <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 600; color: #0F172A; margin-bottom: 0.35rem;">
          <span>${f.factor}</span>
          <span style="color: #64748B; font-weight: 500; font-size: 0.8rem;">${f.value}</span>
        </div>
        <div style="height: 8px; background: #E2E8F0; border-radius: 999px; overflow: hidden;">
          <div class="factor-bar-fill ${fillClass}" style="height: 100%; width: ${fillWidth}%;"></div>
        </div>
      </div>
    `;
  }).join('');

  body.innerHTML = `
    <!-- General Info Grid -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1.25rem; background: #F1F5F9; padding: 1rem; border-radius: 12px; border: 1px solid #E2E8F0;">
      <div><span style="font-size: 0.75rem; color: #64748B; font-weight: 600;">Specialty</span><br><strong style="color: #0F172A;">${apt.specialty}</strong></div>
      <div><span style="font-size: 0.75rem; color: #64748B; font-weight: 600;">Slot</span><br><strong style="color: #0F172A;">${apt.date} ${apt.time}</strong></div>
      <div><span style="font-size: 0.75rem; color: #64748B; font-weight: 600;">Lead Time</span><br><strong style="color: #0F172A;">${apt.lead_time_days} days</strong></div>
      <div><span style="font-size: 0.75rem; color: #64748B; font-weight: 600;">Reminder</span><br><strong style="color: #0F172A;">${apt.reminder_status}</strong></div>
    </div>

    <!-- Probability Gauge Card -->
    <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 14px; padding: 1.35rem; text-align: center; margin-bottom: 1.25rem; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);">
      <div style="font-size: 0.78rem; text-transform: uppercase; color: #64748B; font-weight: 700; letter-spacing: 0.04em;">Estimated No-Show Probability</div>
      <div style="font-family: 'Outfit', sans-serif; font-size: 3rem; font-weight: 800; color: ${apt.risk_level === 'HIGH' ? '#DC2626' : '#0A4D68'}; line-height: 1.1; margin: 0.3rem 0;">
        ${probPct}%
      </div>
      <span class="badge ${badgeClass}">${apt.risk_level} RISK</span>
    </div>

    <!-- Factors Section -->
    <div style="margin-bottom: 1.25rem;">
      <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 0.75rem; color: #0F172A;">
        Factors considered by the model
      </h4>
      ${factorsHtml}
    </div>

    <!-- Recommended Action Section -->
    <div style="background: #EBF5FB; border: 1px solid #BAE6FD; border-radius: 12px; padding: 1rem; margin-bottom: 1.25rem;">
      <div style="font-size: 0.78rem; font-weight: 700; color: #0A4D68; text-transform: uppercase; letter-spacing: 0.03em;">Recommended Action</div>
      <div style="font-weight: 700; font-size: 1.05rem; margin-top: 0.2rem; color: #0F172A;">${apt.recommended_action}</div>
    </div>

    <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
      <button class="btn btn-primary" style="flex: 1; font-size: 0.85rem;" id="btnMarkReminderSent">
        <i class="ph-bold ph-check-circle"></i> Mark Reminder Sent
      </button>
      <button class="btn-cancel-appt" style="padding: 0.55rem 1rem; font-size: 0.85rem;" id="btnDrawerCancelAppt">
        <i class="ph-bold ph-trash"></i> Cancel Slot
      </button>
    </div>
  `;

  document.getElementById('drawerBackdrop').classList.add('active');

  document.getElementById('btnMarkReminderSent')?.addEventListener('click', () => {
    apt.reminder_status = "Sent (Priority)";
    apt.noshow_probability = Math.max(0.15, Math.round((apt.noshow_probability - 0.25) * 100) / 100);
    apt.risk_level = apt.noshow_probability >= 0.60 ? "HIGH" : (apt.noshow_probability >= 0.40 ? "MEDIUM" : "LOW");
    openAppointmentDrawer(apt);
    renderDashboard();
    renderAppointmentsTable();
  });

  document.getElementById('btnDrawerCancelAppt')?.addEventListener('click', () => {
    cancelAppointment(apt.appointment_id);
  });
}

function closeAppointmentDrawer() {
  document.getElementById('drawerBackdrop').classList.remove('active');
}

// --- Smart Waitlist Page Renderer & Assignment ---
function renderWaitlist() {
  const grid = document.getElementById('candidatesGrid');
  if (!grid) return;
  grid.innerHTML = '';

  // Update Slot Banner with preserved cancelled slot or default
  const slotSpec = document.getElementById('slotSpecialty');
  const slotDate = document.getElementById('slotDate');
  const slotTime = document.getElementById('slotTime');

  if (state.pendingReplacementSlot) {
    if (slotSpec) slotSpec.innerText = state.pendingReplacementSlot.specialty;
    if (slotDate) slotDate.innerText = state.pendingReplacementSlot.date;
    if (slotTime) slotTime.innerText = state.pendingReplacementSlot.time;
  }

  if (!state.waitlistCandidates.length) {
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">No candidates currently on waitlist.</div>`;
    return;
  }

  state.waitlistCandidates.forEach((cand, idx) => {
    const isTop = idx === 0;
    const card = document.createElement('div');
    card.className = `candidate-card ${isTop ? 'recommended' : ''}`;
    
    card.innerHTML = `
      ${isTop ? '<div class="rec-badge-top">Top Recommendation</div>' : ''}
      <div class="candidate-header">
        <div>
          <div class="candidate-name">${cand.patient_name}</div>
          <div class="candidate-id">${cand.waitlist_id} • ${cand.priority}</div>
        </div>
        <div class="compat-score">${cand.compatibility_score}%</div>
      </div>
      <div style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 0.75rem;">
        Prefers: <strong>${cand.preferred_time}</strong> • Waiting <strong>${cand.waiting_duration_days} days</strong>
      </div>
      <div style="display: flex; gap: 0.5rem;">
        <button class="btn btn-secondary btn-sm btn-select-cand" style="flex: 1;">Select</button>
        <button class="btn btn-primary btn-sm btn-assign-cand" style="background: var(--accent-cyan); border-color: var(--accent-cyan);">Assign to Slot</button>
      </div>
    `;

    card.querySelector('.btn-select-cand').addEventListener('click', (e) => {
      e.stopPropagation();
      selectCandidate(cand);
    });

    card.querySelector('.btn-assign-cand').addEventListener('click', (e) => {
      e.stopPropagation();
      assignPatientToSlot(cand);
    });

    card.addEventListener('click', () => selectCandidate(cand));
    grid.appendChild(card);
  });

  if (state.waitlistCandidates.length > 0) {
    selectCandidate(state.waitlistCandidates[0]);
  }
}

function selectCandidate(cand) {
  state.selectedCandidate = cand;

  const content = document.getElementById('explanationContent');
  if (!content) return;

  const reasonsHtml = (cand.reasons || []).map(r => `
    <li><i class="ph-bold ph-check-circle"></i> <span>${r}</span></li>
  `).join('');

  content.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
      <div>
        <h4 style="font-family: 'Outfit'; font-size: 1.2rem; font-weight: 700;">${cand.patient_name}</h4>
        <span class="badge badge-blue">${cand.waitlist_id}</span>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 0.75rem; color: var(--text-muted);">Compatibility</div>
        <div style="font-family: 'Outfit'; font-size: 1.6rem; font-weight: 800; color: var(--accent-cyan);">${cand.compatibility_score}%</div>
      </div>
    </div>

    <div style="margin-bottom: 1rem;">
      <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 0.5rem;">
        Transparent Recommendation Factors
      </div>
      <ul class="reasons-list">
        ${reasonsHtml}
      </ul>
    </div>

    <button class="btn btn-primary" id="btnAssignPanel" style="width: 100%; margin-top: 1rem; background: var(--accent-cyan);">
      <i class="ph-bold ph-check-circle"></i> Assign to Slot Now
    </button>
  `;

  document.getElementById('btnAssignPanel')?.addEventListener('click', () => {
    assignPatientToSlot(cand);
  });
}

// --- Assign Waitlist Patient to Slot ---
async function assignPatientToSlot(cand) {
  const targetSlot = state.activeSlot || state.pendingReplacementSlot || {
    specialty: cand.specialty || 'Cardiology',
    date: '2026-09-24',
    time: '10:30 AM'
  };

  // Perform backend assignment call if connected
  if (state.isBackendConnected) {
    try {
      const res = await fetch('/api/waitlist/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          waitlist_id: cand.waitlist_id,
          candidate: cand,
          slot: targetSlot
        })
      });
      const data = await res.json();
      await loadData(); // fully reload to see the replaced slot
    } catch (err) {
      console.warn("Backend assignment call failed:", err);
    }
  } else {
    // Remove the empty slot from frontend state locally
    state.appointments = state.appointments.filter(a => a.appointment_id !== targetSlot.appointment_id);
    const newApt = {
      appointment_id: targetSlot.appointment_id || `APT-W${1050 + state.appointments.length}`,
      patient_name: cand.patient_name,
      specialty: targetSlot.specialty,
      date: targetSlot.date,
      time: targetSlot.time,
      lead_time_days: 1,
      previous_noshows: 0,
      reminder_status: "Confirmed (Waitlist Backfill)",
      noshow_probability: 0.18,
      risk_level: "LOW",
      recommended_action: "Standard Outreach",
      age_band: "35-44",
      weekday: "Scheduled",
      factors: [
        { factor: "Waitlist backfill", value: "Replaced cancelled slot", impact: "High Priority" },
        { factor: "Reminder status", value: "Confirmed via Waitlist", impact: "High Decrease" }
      ]
    };
    state.appointments.push(newApt);
  }

  // Remove patient from waitlist
  state.waitlistCandidates = state.waitlistCandidates.filter(c => c.waitlist_id !== cand.waitlist_id);
  state.filteredAppointments = [...state.appointments];

  // Hide cancellation banner & show success assignment banner
  document.getElementById('cancelledSlotBanner').style.display = 'none';
  
  const successBanner = document.getElementById('assignmentSuccessBanner');
  const successText = document.getElementById('assignmentSuccessText');
  if (successBanner && successText) {
    successText.innerText = `Slot successfully replaced with ${cand.patient_name}.`;
    successBanner.style.display = 'flex';
  }

  // Clear pending slot
  state.pendingReplacementSlot = null;

  // Refresh UI
  renderDashboard();
  renderAppointmentsTable();
  renderWaitlist();
}

// --- UPLOAD PATIENT DATA LOGIC (CSV / EXCEL PARSER & DUPLICATE PROTECTION) ---
function initUploadFeature() {
  const btnOpen1 = document.getElementById('btnOpenUploadModal');
  const btnOpen2 = document.getElementById('btnOpenUploadModalAppts');
  const btnClose = document.getElementById('btnCloseUploadCard');
  const uploadCard = document.getElementById('uploadCard');
  const dropZone = document.getElementById('uploadDropZone');
  const fileInput = document.getElementById('csvFileInput');
  const btnBrowse = document.getElementById('btnBrowseFile');
  const btnProcess = document.getElementById('btnProcessUpload');
  const btnGoToAppts = document.getElementById('btnGoToAppointmentsAfterUpload');

  const showUpload = () => {
    if (uploadCard) {
      uploadCard.style.display = 'block';
      uploadCard.scrollIntoView({ behavior: 'smooth' });
    }
  };

  btnOpen1?.addEventListener('click', showUpload);
  btnOpen2?.addEventListener('click', showUpload);
  btnClose?.addEventListener('click', () => { if (uploadCard) uploadCard.style.display = 'none'; });

  btnBrowse?.addEventListener('click', () => fileInput?.click());
  dropZone?.addEventListener('click', (e) => {
    if (e.target !== btnBrowse) fileInput?.click();
  });

  // Drag & Drop handlers
  dropZone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));

  dropZone?.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleSelectedFile(e.dataTransfer.files[0]);
    }
  });

  fileInput?.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleSelectedFile(e.target.files[0]);
    }
  });

  btnProcess?.addEventListener('click', processUploadedFile);

  btnGoToAppts?.addEventListener('click', () => {
    if (uploadCard) uploadCard.style.display = 'none';
    switchTab('appointments');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

function handleSelectedFile(file) {
  state.selectedFile = file;
  document.getElementById('selectedFileName').innerText = file.name;
  document.getElementById('selectedFileSize').innerText = `${(file.size / 1024).toFixed(1)} KB`;
  document.getElementById('selectedFileContainer').style.display = 'flex';
  document.getElementById('uploadResultsSummary').style.display = 'none';
}

function processUploadedFile() {
  if (!state.selectedFile) return;

  const progressState = document.getElementById('uploadProgressState');
  const progressBar = document.getElementById('uploadProgressBar');
  if (progressState) progressState.style.display = 'block';

  let pct = 0;
  const interval = setInterval(() => {
    pct += 25;
    if (progressBar) progressBar.style.width = `${pct}%`;
    if (pct >= 100) {
      clearInterval(interval);
      readAndValidateFileData(state.selectedFile);
    }
  }, 150);
}

function readAndValidateFileData(file) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    const content = e.target.result;
    const records = parseCSVText(content);
    
    let addedCount = 0;
    let skippedDuplicates = 0;
    let invalidCount = 0;

    // Send to backend API if connected
    if (state.isBackendConnected) {
      try {
        const res = await fetch('/api/appointments/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ records: records })
        });
        const data = await res.json();
        addedCount = data.added_count;
        skippedDuplicates = data.skipped_duplicates;
        invalidCount = data.invalid_count;
        
        // Refresh live appointment list from server
        const resAppts = await fetch('/api/appointments/upcoming');
        const dataAppts = await resAppts.json();
        state.appointments = dataAppts.appointments || [];
      } catch (err) {
        console.warn("Backend upload failed, using local processing:", err);
        const result = processLocalUploadRecords(records);
        addedCount = result.addedCount;
        skippedDuplicates = result.skippedDuplicates;
        invalidCount = result.invalidCount;
      }
    } else {
      const result = processLocalUploadRecords(records);
      addedCount = result.addedCount;
      skippedDuplicates = result.skippedDuplicates;
      invalidCount = result.invalidCount;
    }

    state.filteredAppointments = [...state.appointments];

    // Hide progress & show summary
    document.getElementById('uploadProgressState').style.display = 'none';
    document.getElementById('sumTotalCount').innerText = records.length;
    document.getElementById('sumValidCount').innerText = addedCount;
    document.getElementById('sumDupCount').innerText = skippedDuplicates;
    document.getElementById('sumInvalidCount').innerText = invalidCount;
    document.getElementById('uploadResultsSummary').style.display = 'block';

    renderDashboard();
    renderAppointmentsTable();
  };

  reader.readAsText(file);
}

function processLocalUploadRecords(records) {
  let addedCount = 0;
  let skippedDuplicates = 0;
  let invalidCount = 0;

  const existingKeys = new Set(
    state.appointments.map(a => `${a.appointment_id}|${a.patient_name.toLowerCase()}|${a.date}|${a.time}`)
  );

  records.forEach(rec => {
    if (!rec.patient_name || !rec.date || !rec.specialty) {
      invalidCount++;
      return;
    }

    const dupKey = `${rec.appointment_id}|${rec.patient_name.toLowerCase()}|${rec.date}|${rec.time}`;
    if (existingKeys.has(dupKey) || state.appointments.some(a => a.appointment_id === rec.appointment_id)) {
      skippedDuplicates++;
      return;
    }

    const leadTime = parseInt(rec.lead_time_days) || 7;
    const prevNoshows = parseInt(rec.previous_noshows) || 0;
    const reminder = rec.reminder_status || 'Not Sent';

    let prob = 0.15 + (prevNoshows * 0.25) + (leadTime * 0.015);
    if (reminder === 'Confirmed') prob -= 0.30;
    else if (reminder === 'Not Sent') prob += 0.15;

    prob = Math.max(0.05, Math.min(0.95, Math.round(prob * 100) / 100));
    const risk = prob >= 0.60 ? "HIGH" : (prob >= 0.40 ? "MEDIUM" : "LOW");

    const newApt = {
      appointment_id: rec.appointment_id || `APT-${1050 + state.appointments.length}`,
      patient_name: rec.patient_name,
      specialty: rec.specialty,
      date: rec.date,
      time: rec.time || '09:00 AM',
      lead_time_days: leadTime,
      previous_noshows: prevNoshows,
      reminder_status: reminder,
      noshow_probability: prob,
      risk_level: risk,
      recommended_action: risk === 'HIGH' ? "Reminder Priority (SMS)" : "Standard Outreach",
      age_band: rec.age_band || '35-44',
      weekday: rec.weekday || 'Thursday',
      factors: [
        { factor: "Previous no-shows", value: `${prevNoshows} previous`, impact: prevNoshows > 0 ? "High Increase" : "Low" },
        { factor: "Booking lead time", value: `${leadTime} days`, impact: "Moderate Increase" },
        { factor: "Reminder status", value: reminder, impact: reminder === "Not Sent" ? "High Increase" : "Decrease" }
      ]
    };

    state.appointments.push(newApt);
    existingKeys.add(dupKey);
    addedCount++;
  });

  return { addedCount, skippedDuplicates, invalidCount };
}

// Flexible CSV Text Parser & Header Mapper
function parseCSVText(text) {
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());

  const findIdx = (patterns) => headers.findIndex(h => patterns.some(p => h.includes(p)));

  const idxId = findIdx(['patient_id', 'id', 'appt', 'appointment_id', 'pid']);
  const idxName = findIdx(['patient_name', 'name', 'patient', 'full_name']);
  const idxDate = findIdx(['date', 'appointment_date', 'appt_date']);
  const idxTime = findIdx(['time', 'slot', 'appointment_time']);
  const idxSpec = findIdx(['specialty', 'department', 'dept', 'clinic']);
  const idxLead = findIdx(['lead', 'lead_time', 'days']);
  const idxNoshow = findIdx(['noshow', 'no_shows', 'prev']);
  const idxRem = findIdx(['reminder', 'status']);
  const idxAge = findIdx(['age', 'age_band']);
  const idxWeek = findIdx(['weekday', 'day']);

  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (!cols || cols.length === 0) continue;

    const pName = idxName !== -1 ? cols[idxName] : cols[1] || cols[0];
    const pDate = idxDate !== -1 ? cols[idxDate] : cols[3] || '2026-09-26';
    const pSpec = idxSpec !== -1 ? cols[idxSpec] : cols[2] || 'General';

    if (!pName || !pDate || !pSpec) continue;

    records.push({
      appointment_id: idxId !== -1 ? cols[idxId] : `APT-${1050 + i}`,
      patient_name: pName.trim(),
      specialty: pSpec.trim(),
      date: pDate.trim(),
      time: idxTime !== -1 ? cols[idxTime].trim() : '10:00 AM',
      lead_time_days: idxLead !== -1 ? parseInt(cols[idxLead]) || 7 : 7,
      previous_noshows: idxNoshow !== -1 ? parseInt(cols[idxNoshow]) || 0 : 0,
      reminder_status: idxRem !== -1 ? cols[idxRem].trim() : 'Not Sent',
      age_band: idxAge !== -1 ? cols[idxAge].trim() : '35-44',
      weekday: idxWeek !== -1 ? cols[idxWeek].trim() : 'Thursday'
    });
  }

  return records;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// --- Hackathon 10-Step Demo Controller ---
const DEMO_STEPS = [
  { step: 1, title: "1/10: Dashboard Overview", action: () => switchTab('dashboard') },
  { step: 2, title: "2/10: Inspect Risk Distribution", action: () => { switchTab('dashboard'); document.getElementById('riskDonutChart')?.scrollIntoView({ behavior: 'smooth' }); } },
  { step: 3, title: "3/10: Open High-Risk Appointment", action: () => { switchTab('dashboard'); if (state.appointments.length) openAppointmentDrawer(state.appointments[0]); } },
  { step: 4, title: "4/10: Review Model Factors (78% Risk)", action: () => {} },
  { step: 5, title: "5/10: Note Reminder Priority Action", action: () => {} },
  { step: 6, title: "6/10: Navigate to Smart Waitlist", action: () => { closeAppointmentDrawer(); switchTab('waitlist'); } },
  { step: 7, title: "7/10: View Available Slot (Cardiology)", action: () => {} },
  { step: 8, title: "8/10: Rank Compatible Candidates", action: () => {} },
  { step: 9, title: "9/10: Select Recommended Candidate (Sarah Jenkins)", action: () => { if (state.waitlistCandidates.length) selectCandidate(state.waitlistCandidates[0]); } },
  { step: 10, title: "10/10: Review About & Operational Workflow", action: () => { closeAppointmentDrawer(); switchTab('about'); } }
];

function initDemoController() {
  document.getElementById('btnDemoNext')?.addEventListener('click', () => {
    if (state.demoStep < DEMO_STEPS.length - 1) {
      state.demoStep++;
    } else {
      state.demoStep = 0;
    }
    runDemoStep();
  });

  document.getElementById('btnDemoPrev')?.addEventListener('click', () => {
    if (state.demoStep > 0) {
      state.demoStep--;
      runDemoStep();
    }
  });
}

function runDemoStep() {
  const s = DEMO_STEPS[state.demoStep];
  const label = document.getElementById('demoStepLabel');
  if (label) label.innerText = s.title;
  s.action();
}
