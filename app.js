    const COLORS = [
      '#2563eb', '#7c3aed', '#db2777', '#dc2626', '#ea580c',
      '#ca8a04', '#16a34a', '#0d9488', '#0891b2', '#4f46e5',
      '#9333ea', '#c026d3', '#e11d48', '#f97316', '#65a30d',
      '#1d4ed8', '#6d28d9', '#be185d', '#b91c1c', '#c2410c',
      '#a16207', '#15803d', '#0f766e', '#0e7490', '#4338ca',
      '#7e22ce', '#a21caf', '#be123c', '#c2410c', '#4d7c0f',
      '#0369a1', '#7c2d12', '#365314', '#134e4a', '#1e3a8a',
      '#831843', '#9f1239', '#854d0e', '#166534', '#155e75',
      '#312e81', '#581c87', '#701a75', '#9a3412', '#3f6212',
      '#0c4a6e', '#1e40af', '#5b21b6', '#9d174d', '#b45309'
    ];

    let state = {
      schoolName: 'My School',
      session: '',
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      slots: [
        { id: 'p1', label: 'Period 1', start: '08:00', end: '08:45', isBreak: false },
        { id: 'p2', label: 'Period 2', start: '08:45', end: '09:30', isBreak: false },
        { id: 'b1', label: 'Short Break', start: '09:30', end: '09:45', isBreak: true },
        { id: 'p3', label: 'Period 3', start: '09:45', end: '10:30', isBreak: false },
        { id: 'p4', label: 'Period 4', start: '10:30', end: '11:15', isBreak: false },
        { id: 'b2', label: 'Lunch', start: '11:15', end: '12:00', isBreak: true },
        { id: 'p5', label: 'Period 5', start: '12:00', end: '12:45', isBreak: false },
        { id: 'p6', label: 'Period 6', start: '12:45', end: '13:30', isBreak: false },
        { id: 'p7', label: 'Period 7', start: '13:30', end: '14:15', isBreak: false },
        { id: 'p8', label: 'Period 8', start: '14:15', end: '15:00', isBreak: false },
        { id: 'p9', label: 'Period 9', start: '15:00', end: '15:45', isBreak: false },
      ],
      examSlots: [
        { id: 'ep1', label: 'Paper 1', start: '08:00', end: '10:00', isBreak: false },
        { id: 'eb1', label: 'Short Break', start: '10:00', end: '10:30', isBreak: true },
        { id: 'ep2', label: 'Paper 2', start: '10:30', end: '12:30', isBreak: false },
        { id: 'eb2', label: 'Lunch', start: '12:30', end: '13:30', isBreak: true },
        { id: 'ep3', label: 'Paper 3', start: '13:30', end: '15:30', isBreak: false },
      ],
      /** Exam/CA days with optional calendar dates: [{ day, date }] */
      examSchedule: [],
      classes: [],
      subjects: [],
      assignments: [],
      /** Folded combined-subject cells: key day|slotId|classId → true when folded */
      foldedGroups: {},
      exams: [],
      /** Personal reading / study timetable */
      studySubjects: [],   // { id, name, periods, color }
      studyAssignments: [], // { id, day, slotId, subjectId }
      studySlots: [],       // optional custom periods { id, label, start, end, isBreak }
      studyUseSchoolSlots: true, // if true, reading grid uses school teaching periods
      editingStudySubjectId: null,
      currentStudySlot: null, // { day, slotId }
      editingClassId: null,
      editingSubjectId: null,
      editingSlotId: null,
      editingSlotList: 'slots',
      currentSlot: null,
      currentExamSlot: null,
      currentView: 'school',
      selectedClassId: null,
      selectedTeacher: null,
      compareLeftView: 'school',
      compareLeftClassId: null,
      compareLeftTeacher: null,
      showClassLoad: true,
      showTeacherLoad: true,
      printSubjectStyle: 'color', // 'color' | 'plain'
      compareSchoolCollapsed: false,
      daySlotTimes: {}, // { day: { slotId: {start, end} } } - per-day custom times
      usePerDayTimes: false,
      jumatEnabled: true,
      jumatSlotId: null, // teaching slot id used for JUMAT on Friday (any period)
      /** Autogenerate extra rules (persisted) */
      autoGenRules: {
        subjectGroups: [],   // { id, name, subjectIds[], classIds[] }
        syncBlocks: [],      // { id, subjectIds[], classIds[], useGroupId? }
        noDoubleSubjects: [], // subjectId[] — never force double
        forceDoubleSubjects: [], // subjectId[] — 2 periods/week must be consecutive double
        includeSubjectIds: null, // null = all; string[] = only these subjects
        teacherBlocks: []    // { id, teacher, days[], slotIds[] }
      }
    };

    function ensurePeriod9Slot() {
      // Keep a valid JUMAT period selection (any teaching period — not fixed to Period 9)
      ensureJumatSlotId();
      if (state.jumatEnabled !== false) clearJumatAssignments();
    }

    /** Teaching periods available for JUMAT selection */
    function getJumatPeriodOptions() {
      return (state.slots || []).filter(s => !s.isBreak);
    }

    /** Resolve jumatSlotId to a real teaching period (default: last period, or legacy Period 9 if present) */
    function ensureJumatSlotId() {
      if (!state.slots) state.slots = [];
      const teaching = getJumatPeriodOptions();
      if (!teaching.length) {
        state.jumatSlotId = null;
        return null;
      }
      if (state.jumatSlotId && teaching.some(s => s.id === state.jumatSlotId)) {
        return state.jumatSlotId;
      }
      // Prefer legacy Period 9 by label if present
      const p9 = teaching.find(s => isPeriod9Slot(s));
      state.jumatSlotId = p9 ? p9.id : teaching[teaching.length - 1].id;
      return state.jumatSlotId;
    }

    function getJumatSlotLabel() {
      const id = ensureJumatSlotId();
      const slot = (state.slots || []).find(s => s.id === id);
      return slot ? slot.label : 'selected period';
    }

    function isJumatSlot(slot) {
      if (!slot || slot.isBreak) return false;
      const id = ensureJumatSlotId();
      return !!id && slot.id === id;
    }

    function fillJumatSlotSelect() {
      const sel = document.getElementById('jumatSlotSelect');
      if (!sel) return;
      const teaching = getJumatPeriodOptions();
      const cur = ensureJumatSlotId();
      if (!teaching.length) {
        sel.innerHTML = '<option value="">Add a teaching period first</option>';
        sel.disabled = true;
        return;
      }
      sel.disabled = state.jumatEnabled === false;
      sel.innerHTML = teaching.map(s =>
        '<option value="' + s.id + '"' + (s.id === cur ? ' selected' : '') + '>' +
        escapeHtml(s.label) +
        ((s.start && s.end) ? (' (' + escapeHtml(s.start + '–' + s.end) + ')') : '') +
        '</option>'
      ).join('');
    }

    function setJumatSlot(slotId) {
      const teaching = getJumatPeriodOptions();
      if (!teaching.some(s => s.id === slotId)) {
        showToast('Choose a valid teaching period');
        fillJumatSlotSelect();
        return;
      }
      state.jumatSlotId = slotId;
      if (state.jumatEnabled !== false) clearJumatAssignments();
      renderTable();
      if (typeof updateConflicts === 'function') updateConflicts();
      fillJumatSlotSelect();
      showToast('JUMAT set to ' + getJumatSlotLabel() + ' on Friday');
      if (typeof pushHistory === 'function') pushHistory();
      else if (typeof autosaveNow === 'function') autosaveNow();
    }

    function collapseAllSidebarCards() {
      ['settingsCard', 'subjectsCard', 'conflictsCard', 'classesCard', 'studySubjectsCard', 'teachingSlotsCard', 'examSlotsCard'].forEach(id => {
        setSidebarCardCollapsed(id, true);
      });
    }

    function init() {
      loadData();
      if (!state.examSlots || !state.examSlots.length) {
        state.examSlots = [
          { id: 'ep1', label: 'Paper 1', start: '08:00', end: '10:00', isBreak: false },
          { id: 'eb1', label: 'Short Break', start: '10:00', end: '10:30', isBreak: true },
          { id: 'ep2', label: 'Paper 2', start: '10:30', end: '12:30', isBreak: false },
          { id: 'eb2', label: 'Lunch', start: '12:30', end: '13:30', isBreak: true },
          { id: 'ep3', label: 'Paper 3', start: '13:30', end: '15:30', isBreak: false },
        ];
      }
      ensurePeriod9Slot();
      renderColorPicker();
      renderSlots();
      renderExamSlots();
      renderClasses();
      renderSubjects();
      if (typeof syncStudySlotModeUi === 'function') syncStudySlotModeUi();
      if (typeof renderStudySubjects === 'function') renderStudySubjects();
      switchView(state.currentView || 'school');
      // Start with all setup sections collapsed
      collapseAllSidebarCards();
      updateMeta();
      if (typeof applyZoom === 'function') applyZoom();
      initHistory();
      if (typeof ensureAssignmentIds === 'function') ensureAssignmentIds();
      if (typeof initMoveHintGlobal === 'function') initMoveHintGlobal();
      if (typeof syncPrintSubjectStyleSelect === 'function') syncPrintSubjectStyleSelect();
      if (typeof syncJumatToggle === 'function') syncJumatToggle();
      // Refresh “Saved · 2 min ago” text periodically
      if (!window._saveStatusTimer) {
        window._saveStatusTimer = setInterval(function () {
          if (typeof updateDirtyIndicator === 'function') updateDirtyIndicator();
        }, 15000);
      }
      if (typeof updateDirtyIndicator === 'function') updateDirtyIndicator();
      if (typeof initMobileLayout === 'function') initMobileLayout();
      // Sound preference
      try {
        const s = localStorage.getItem('akeemTimetableSound');
        if (s === '0') state.soundEnabled = false;
        else if (s === '1') state.soundEnabled = true;
        else if (state.soundEnabled == null) state.soundEnabled = true;
      } catch (e) { state.soundEnabled = true; }
      if (typeof syncSoundToggle === 'function') syncSoundToggle();
      // Browsers require a user gesture before audio plays
      if (!window._soundGestureBound) {
        window._soundGestureBound = true;
        ['pointerdown', 'touchstart', 'keydown'].forEach(function (ev) {
          document.addEventListener(ev, function () {
            if (typeof unlockAudio === 'function') unlockAudio();
          }, { once: false, passive: true });
        });
      }
    }

    function isMobileLayout() {
      return window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
    }

    function toggleMobileSidebar() {
      // Prefer matchMedia, but always allow if Setup button is visible (some WebViews differ)
      const setupBtn = document.getElementById('btnMobileSetup');
      const mobileUi = isMobileLayout() || (setupBtn && window.getComputedStyle(setupBtn).display !== 'none');
      if (!mobileUi) return;
      const opening = !document.body.classList.contains('mobile-sidebar-open');
      document.body.classList.toggle('mobile-sidebar-open', opening);
      document.body.classList.remove('mobile-more-open');
      const btn = document.getElementById('btnMobileMore');
      if (btn) btn.textContent = '⋯ More';
      if (opening) {
        // Everything under Setup starts folded; user expands what they need
        if (typeof collapseAllSidebarCards === 'function') collapseAllSidebarCards();
        const side = document.getElementById('topSidebar');
        if (side) {
          try { side.scrollTop = 0; } catch (e) {}
        }
      }
    }

    function closeMobileSidebar() {
      document.body.classList.remove('mobile-sidebar-open');
    }

    function toggleMobileMore() {
      document.body.classList.toggle('mobile-more-open');
      const open = document.body.classList.contains('mobile-more-open');
      const btn = document.getElementById('btnMobileMore');
      if (btn) btn.textContent = open ? '⋯ Less' : '⋯ More';
    }

    function initMobileLayout() {
      // Close drawer when switching main views on phone
      document.querySelectorAll('.view-tab').forEach(function (tab) {
        tab.addEventListener('click', function () {
          if (isMobileLayout()) closeMobileSidebar();
        });
      });
      // Escape closes drawer / more panel
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          closeMobileSidebar();
          document.body.classList.remove('mobile-more-open');
          const btn = document.getElementById('btnMobileMore');
          if (btn) btn.textContent = '⋯ More';
        }
      });
      // When resizing to desktop, clear mobile-only body classes
      if (window.matchMedia) {
        const mq = window.matchMedia('(max-width: 768px)');
        const onChange = function () {
          if (!mq.matches) {
            closeMobileSidebar();
            document.body.classList.remove('mobile-more-open');
            const btn = document.getElementById('btnMobileMore');
            if (btn) btn.textContent = '⋯ More';
          }
        };
        if (mq.addEventListener) mq.addEventListener('change', onChange);
        else if (mq.addListener) mq.addListener(onChange);
      }
    }

    function updateMeta() {
      state.schoolName = document.getElementById('schoolName').value || 'My School';
      const sessEl = document.getElementById('sessionInput');
      state.session = sessEl ? (sessEl.value || '').trim() : (state.session || '');
      const c = state.classes.length;
      const s = state.subjects.length;
      const p = state.slots.filter(x => !x.isBreak).length;
      const b = state.slots.filter(x => x.isBreak).length;
      const ep = (state.examSlots || []).filter(x => !x.isBreak).length;
      const eb = (state.examSlots || []).filter(x => x.isBreak).length;
      let meta;
      const mobile = typeof isMobileLayout === 'function' && isMobileLayout();
      if (mobile) {
        // Shorter line so text stays inside the phone header
        meta = (state.schoolName || 'My School') +
          (state.session ? ' · ' + state.session : '') +
          ' · ' + c + ' classes · ' + s + ' subjects · ' + p + ' periods';
      } else {
        meta = state.schoolName + ' · ' + c + ' classes · ' + s + ' subjects · ' + p + ' periods · ' + b + ' breaks · Exam: ' + ep + ' sessions / ' + eb + ' breaks';
        if (state.session) meta = state.schoolName + ' · ' + state.session + ' · ' + c + ' classes · ' + s + ' subjects · ' + p + ' periods · ' + b + ' breaks · Exam: ' + ep + ' sessions / ' + eb + ' breaks';
      }
      document.getElementById('headerMeta').textContent = meta;
      // Settings fields also autosave immediately
      if (typeof autosaveNow === 'function' && !historyQuiet) autosaveNow();
      if (typeof updateDirtyIndicator === 'function') updateDirtyIndicator();
    }

    /** Set toolbar title; optional session appears on the right (used on screen & print). */
    function getSchoolPeriodTotals() {
      let expected = 0;
      state.classes.forEach(c => {
        state.subjects.forEach(s => {
          expected += getWeeklyFor(s.id, c.id) || 0;
        });
      });
      const placed = (state.assignments || []).length;
      return { placed, expected };
    }

    function getTeacherPeriodTotals(teacherName) {
      const tKey = normalizeTeacherName(teacherName);
      if (!tKey) return { placed: 0, expected: 0, cellPlaced: 0, cellExpected: 0, bySubject: [], byClassArm: [], isTeacher: true };
      let expected = 0;
      let placed = 0;
      const armMap = {};
      const cellKeys = {}; // unique day|slot cells that have subjects (combined classes = 1)
      state.subjects.forEach(s => {
        if (normalizeTeacherName(s.teacher) !== tKey) return;
        state.classes.forEach(c => {
          const exp = getWeeklyFor(s.id, c.id) || 0;
          if (exp <= 0) return;
          expected += exp;
          armMap[s.id + '|' + c.id] = {
            subjectName: s.name,
            className: c.name,
            subjectId: s.id,
            classId: c.id,
            placed: 0,
            expected: exp
          };
        });
      });
      (state.assignments || []).forEach(a => {
        const s = state.subjects.find(x => x.id === a.subjectId);
        if (!s || normalizeTeacherName(s.teacher) !== tKey) return;
        placed++;
        // One grid cell per day+period (multiple classes in same cell count once)
        if (a.day && a.slotId) cellKeys[a.day + '|' + a.slotId] = true;
        const key = a.subjectId + '|' + a.classId;
        if (!armMap[key]) {
          const cls = state.classes.find(c => c.id === a.classId);
          armMap[key] = {
            subjectName: s.name,
            className: cls ? cls.name : '?',
            subjectId: a.subjectId,
            classId: a.classId,
            placed: 0,
            expected: getWeeklyFor(a.subjectId, a.classId) || 0
          };
        }
        armMap[key].placed++;
      });
      const byClassArm = Object.keys(armMap).map(k => armMap[k])
        .filter(x => x.expected > 0 || x.placed > 0)
        .sort((a, b) => {
          const sn = a.subjectName.localeCompare(b.subjectName);
          return sn !== 0 ? sn : a.className.localeCompare(b.className);
        });
      const subAgg = {};
      byClassArm.forEach(row => {
        if (!subAgg[row.subjectId]) subAgg[row.subjectId] = { name: row.subjectName, placed: 0, expected: 0 };
        subAgg[row.subjectId].placed += row.placed;
        subAgg[row.subjectId].expected += row.expected;
      });
      const bySubject = Object.keys(subAgg).map(id => subAgg[id]).sort((a, b) => a.name.localeCompare(b.name));
      // Unique cells with subjects; remaining unplaced assignments may still need their own cells
      const cellPlaced = Object.keys(cellKeys).length;
      const remaining = Math.max(0, expected - placed);
      const cellExpected = cellPlaced + remaining;
      return { placed, expected, cellPlaced, cellExpected, bySubject, byClassArm, isTeacher: true };
    }


    function getClassPeriodTotals(classId) {
      if (!classId) return { placed: 0, expected: 0, bySubject: [], byClassArm: [] };
      let expected = 0;
      let placed = 0;
      const subMap = {};
      state.subjects.forEach(s => {
        const exp = getWeeklyFor(s.id, classId) || 0;
        if (exp <= 0) return;
        expected += exp;
        subMap[s.id] = {
          subjectName: s.name,
          className: '',
          subjectId: s.id,
          classId: classId,
          placed: 0,
          expected: exp,
          teacher: s.teacher || ''
        };
      });
      (state.assignments || []).forEach(a => {
        if (a.classId !== classId) return;
        const s = state.subjects.find(x => x.id === a.subjectId);
        if (!s) return;
        placed++;
        if (!subMap[a.subjectId]) {
          subMap[a.subjectId] = {
            subjectName: s.name,
            className: '',
            subjectId: a.subjectId,
            classId: classId,
            placed: 0,
            expected: getWeeklyFor(a.subjectId, classId) || 0,
            teacher: s.teacher || ''
          };
        }
        subMap[a.subjectId].placed++;
      });
      const byClassArm = Object.keys(subMap).map(k => subMap[k])
        .filter(x => x.expected > 0 || x.placed > 0)
        .sort((a, b) => a.subjectName.localeCompare(b.subjectName));
      const bySubject = byClassArm.map(r => ({
        name: r.subjectName,
        placed: r.placed,
        expected: r.expected
      }));
      return { placed, expected, bySubject, byClassArm };
    }

    function formatPeriodLoad(placed, expected, bySubject, byClassArm, forPrint) {
      if (!expected && !placed && !(byClassArm && byClassArm.length) && !(bySubject && bySubject.length)) {
        return { text: '0/0', cls: 'empty', detail: '' };
      }
      let text;
      // Print: only overall total e.g. 30/30
      if (forPrint) {
        text = placed + '/' + expected;
      } else if (byClassArm && byClassArm.length) {
        text = byClassArm.map(r =>
          r.subjectName + ' ' + r.className + ' ' + r.placed + '/' + r.expected
        ).join(' · ');
        text += '  ·  ' + placed + '/' + expected;
      } else if (bySubject && bySubject.length) {
        text = bySubject.map(s => s.name + ' ' + s.placed + '/' + s.expected).join(' · ');
        text += '  ·  ' + placed + '/' + expected;
      } else {
        text = placed + '/' + expected + ' periods';
      }
      let cls = 'empty';
      if (expected > 0 && placed >= expected) cls = 'ok';
      else if (placed > 0) cls = 'partial';
      return { text, cls, detail: text };
    }

    /**
     * Highlight all timetable cells/entries matching subject (+ optional class).
     * Used when clicking load chips on Class or Teacher timetable titles.
     */
    function highlightLoadOnTimetable(subjectId, classId) {
      if (!subjectId) {
        showToast('No subject to highlight');
        return;
      }
      // Clear previous highlights
      document.querySelectorAll('.entry.load-highlight').forEach(el => el.classList.remove('load-highlight'));
      document.querySelectorAll('td.slot.load-highlight-cell').forEach(el => el.classList.remove('load-highlight-cell'));
      document.querySelectorAll('td.slot.jump-highlight').forEach(el => el.classList.remove('jump-highlight'));
      document.querySelectorAll('.vt-load-chip.active-filter').forEach(el => el.classList.remove('active-filter'));

      // Mark active chip
      document.querySelectorAll('.vt-load-chip').forEach(chip => {
        const sid = chip.getAttribute('data-subject-id') || '';
        const cid = chip.getAttribute('data-class-id') || '';
        if (sid === subjectId && (!classId || !cid || cid === classId)) {
          chip.classList.add('active-filter');
        }
      });

      const matches = (state.assignments || []).filter(a => {
        if (a.subjectId !== subjectId) return false;
        if (classId && a.classId !== classId) return false;
        return true;
      });

      if (!matches.length) {
        const subj = state.subjects.find(s => s.id === subjectId);
        showToast((subj ? subj.name : 'Subject') + ' is not placed on the grid yet');
        return;
      }

      // Highlight entries by data-assign-id — red blink
      const hitCells = [];
      matches.forEach(a => {
        const entry = document.querySelector('.entry[data-assign-id="' + CSS.escape(a.id) + '"]');
        if (entry) {
          entry.classList.add('load-highlight');
          const cell = entry.closest('td.slot');
          if (cell) {
            cell.classList.add('load-highlight-cell');
            hitCells.push(cell);
          }
        } else {
          // Fallback: match by day/slot/class (also works when group is folded)
          let sel = 'td.slot[data-day="' + CSS.escape(a.day) + '"][data-slot-id="' + CSS.escape(a.slotId) + '"]';
          if (a.classId) sel += '[data-class-id="' + CSS.escape(a.classId) + '"]';
          const cell = document.querySelector(sel) ||
            document.querySelector('td.slot[data-day="' + CSS.escape(a.day) + '"][data-slot-id="' + CSS.escape(a.slotId) + '"]');
          if (cell) {
            cell.classList.add('load-highlight-cell');
            hitCells.push(cell);
            cell.querySelectorAll('.entry').forEach(en => {
              const aid = en.getAttribute('data-assign-id');
              const aids = (en.getAttribute('data-assign-ids') || '').split(',').map(s => s.trim());
              if (aid === a.id || aids.indexOf(a.id) >= 0 || !aid) {
                en.classList.add('load-highlight');
              }
            });
          }
        }
      });

      if (hitCells.length) {
        hitCells[0].scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      }

      clearTimeout(window._loadHighlightTimer);
      window._loadHighlightTimer = setTimeout(() => {
        document.querySelectorAll('.entry.load-highlight').forEach(el => el.classList.remove('load-highlight'));
        document.querySelectorAll('td.slot.load-highlight-cell').forEach(el => el.classList.remove('load-highlight-cell'));
        document.querySelectorAll('.vt-load-chip.active-filter').forEach(el => el.classList.remove('active-filter'));
      }, 6000);

      const subj = state.subjects.find(s => s.id === subjectId);
      const cls = classId ? state.classes.find(c => c.id === classId) : null;
      const label = (subj ? subj.name : 'Subject') + (cls ? ' · ' + cls.name : '');
      showToast('📍 Highlighted ' + matches.length + ' period' + (matches.length > 1 ? 's' : '') + ' — ' + label);
    }

    function setViewTitle(mainText, forPrint, loadInfo) {
      const titleEl = document.getElementById('viewTitle');
      if (!titleEl) return;
      const session = (state.session || '').trim();
      let loadHtml = '';
      const hasArms = loadInfo && loadInfo.byClassArm && loadInfo.byClassArm.length;
      const hasSubs = loadInfo && loadInfo.bySubject && loadInfo.bySubject.length;
      const isTeacherLoad = loadInfo && loadInfo.isTeacher;
      // Teacher totals use unique grid cells (combined classes in one period = 1 cell)
      const totalPlaced = isTeacherLoad ? (loadInfo.cellPlaced || 0) : (loadInfo ? loadInfo.placed : 0);
      const totalExpected = isTeacherLoad ? (loadInfo.cellExpected || 0) : (loadInfo ? loadInfo.expected : 0);
      if (loadInfo && (loadInfo.expected > 0 || loadInfo.placed > 0 || totalPlaced > 0 || forPrint || hasArms || hasSubs)) {
        if (forPrint) {
          if (isTeacherLoad) {
            // Print: only unique cells with subjects (combined classes = 1), e.g. "12 periods"
            const cFull = totalExpected > 0 && totalPlaced >= totalExpected;
            const cCls = cFull ? 'ok' : (totalPlaced > 0 ? 'partial' : 'empty');
            const cellLabel = totalPlaced + (totalPlaced === 1 ? ' period' : ' periods');
            loadHtml =
              '<span class="vt-load ' + cCls + '" title="Timetable cells with subjects (combined classes count as 1)">' +
              escapeHtml(cellLabel) + '</span>';
          } else {
            const f = formatPeriodLoad(loadInfo.placed, loadInfo.expected, null, null, true);
            loadHtml = '<span class="vt-load ' + f.cls + '">' + escapeHtml(f.text) + '</span>';
          }
        } else if (hasArms) {
          // Screen: colored chips per subject+class arm — click highlights on grid
          const chips = loadInfo.byClassArm.map(r => {
            const full = r.expected > 0 && r.placed >= r.expected;
            const partial = r.placed > 0 && !full;
            const cls = full ? 'full' : (partial ? 'partial' : 'none');
            const left = Math.max(0, (r.expected || 0) - (r.placed || 0));
            const armLabel = r.className
              ? (r.subjectName + ' ' + r.className)
              : (r.subjectName + (r.teacher ? ' · ' + r.teacher : ''));
            const tipBase = armLabel;
            const tip = tipBase + ': ' + r.placed + ' of ' + r.expected +
              (left ? ' (' + left + ' left)' : ' (complete)') +
              ' — click to highlight on timetable';
            const sid = r.subjectId || '';
            const cid = r.classId || '';
            return '<span class="vt-load-chip ' + cls + '" role="button" tabindex="0" ' +
              'data-subject-id="' + escapeHtml(sid) + '" data-class-id="' + escapeHtml(cid) + '" ' +
              'onclick="highlightLoadOnTimetable(\'' + escapeHtml(sid) + '\',\'' + escapeHtml(cid) + '\')" ' +
              'onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();highlightLoadOnTimetable(\'' + escapeHtml(sid) + '\',\'' + escapeHtml(cid) + '\');}" ' +
              'title="' + escapeHtml(tip) + '">' +
              escapeHtml(armLabel) + ' ' +
              r.placed + '/' + r.expected + '</span>';
          }).join('');
          if (isTeacherLoad) {
            // Screen: 18/18 (class periods) and "12 periods" (unique cells)
            const aFull = loadInfo.expected > 0 && loadInfo.placed >= loadInfo.expected;
            const aPartial = loadInfo.placed > 0 && !aFull;
            const aCls = aFull ? 'full' : (aPartial ? 'partial' : 'none');
            const cFull = totalExpected > 0 && totalPlaced >= totalExpected;
            const cPartial = totalPlaced > 0 && !cFull;
            const cCls = cFull ? 'full' : (cPartial ? 'partial' : 'none');
            const cellLabel = totalPlaced + (totalPlaced === 1 ? ' period' : ' periods');
            loadHtml = '<span class="vt-load">' + chips +
              '<span class="vt-load-total ' + aCls + '" title="Class periods placed / expected (each class counted separately)">' +
              loadInfo.placed + '/' + loadInfo.expected + '</span>' +
              '<span class="vt-load-total ' + cCls + '" title="Timetable cells with subjects (combined classes in the same period count as 1)">' +
              escapeHtml(cellLabel) + '</span></span>';
          } else {
            const p = loadInfo.placed;
            const e = loadInfo.expected;
            const tFull = e > 0 && p >= e;
            const tPartial = p > 0 && !tFull;
            const tCls = tFull ? 'full' : (tPartial ? 'partial' : 'none');
            loadHtml = '<span class="vt-load">' + chips +
              '<span class="vt-load-total ' + tCls + '" title="Total placed / expected">' +
              p + '/' + e + '</span></span>';
          }
        } else {
          if (isTeacherLoad) {
            const aFull = loadInfo.expected > 0 && loadInfo.placed >= loadInfo.expected;
            const aCls = aFull ? 'ok' : (loadInfo.placed > 0 ? 'partial' : 'empty');
            const cFull = totalExpected > 0 && totalPlaced >= totalExpected;
            const cCls = cFull ? 'ok' : (totalPlaced > 0 ? 'partial' : 'empty');
            const cellLabel = totalPlaced + (totalPlaced === 1 ? ' period' : ' periods');
            loadHtml =
              '<span class="vt-load ' + aCls + '" title="Class periods placed / expected">' +
              escapeHtml(loadInfo.placed + '/' + loadInfo.expected) + '</span>' +
              '<span class="vt-load ' + cCls + '" title="Timetable cells with subjects (combined classes count as 1)">' +
              escapeHtml(cellLabel) + '</span>';
          } else {
            const f = formatPeriodLoad(loadInfo.placed, loadInfo.expected, loadInfo.bySubject, loadInfo.byClassArm, false);
            loadHtml = '<span class="vt-load ' + f.cls + '" title="Placed / expected weekly periods">' +
              escapeHtml(f.text) + '</span>';
          }
        }
      }
      if (forPrint && session) {
        titleEl.innerHTML =
          '<span class="vt-main">' + escapeHtml(mainText) + '</span>' +
          loadHtml +
          '<span class="vt-session">' + escapeHtml(session) + '</span>';
      } else if (loadHtml) {
        titleEl.innerHTML =
          '<span class="vt-main">' + escapeHtml(mainText) + '</span>' + loadHtml;
      } else {
        titleEl.textContent = mainText;
      }
    }

    function updatePeriodLoadTitle() {
      const view = state.currentView;
      if (view === 'school') {
        setViewTitle('School General Timetable', false, getSchoolPeriodTotals());
      } else if (view === 'class' && state.selectedClassId) {
        const c = state.classes.find(x => x.id === state.selectedClassId);
        const main = 'Class Timetable — ' + (c ? c.name : '');
        if (state.showClassLoad !== false) {
          setViewTitle(main, false, getClassPeriodTotals(state.selectedClassId));
        } else {
          setViewTitle(main, false, null);
        }
      } else if (view === 'class') {
        setViewTitle('Select a class', false, null);
      } else if (view === 'teacher' && state.selectedTeacher) {
        const main = 'Teacher Timetable — ' + state.selectedTeacher;
        if (state.showTeacherLoad !== false) {
          setViewTitle(main, false, getTeacherPeriodTotals(state.selectedTeacher));
        } else {
          setViewTitle(main, false, null);
        }
      } else if (view === 'teacher') {
        setViewTitle('Select a teacher', false, null);
      }
    }

    function setSidebarCardCollapsed(cardId, collapsed) {
      const card = document.getElementById(cardId);
      if (!card) return;
      card.classList.toggle('collapsed', !!collapsed);
      const head = card.querySelector('.collapsible-head');
      if (head) head.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    }

    function toggleSidebarCard(cardId) {
      const card = document.getElementById(cardId);
      if (!card) return;
      const next = !card.classList.contains('collapsed');
      // Accordion-style: opening one can leave others open; click-outside collapses all
      setSidebarCardCollapsed(cardId, next);
    }

    function collapseExpandedSidebarCards(exceptCard) {
      document.querySelectorAll('.sidebar .collapsible-card:not(.collapsed)').forEach(card => {
        if (exceptCard && card === exceptCard) return;
        setSidebarCardCollapsed(card.id, true);
      });
    }

    // Click outside an expanded setup card → collapse it
    if (!window._sidebarOutsideClickBound) {
      window._sidebarOutsideClickBound = true;
      document.addEventListener('click', function (ev) {
        // Ignore when a modal is open
        if (document.querySelector('.modal-overlay.open')) return;
        const expanded = document.querySelectorAll('.sidebar .collapsible-card:not(.collapsed)');
        if (!expanded.length) return;
        // Click inside any expanded card (or its controls) → keep open
        for (const card of expanded) {
          if (card.contains(ev.target)) return;
        }
        // Click on a collapsed card head is handled by toggle; don't fight it
        if (ev.target.closest && ev.target.closest('.sidebar .collapsible-head')) return;
        collapseExpandedSidebarCards(null);
      }, true);
    }

    
    function saveTimetableNow(){
      const btn = document.getElementById('saveBtnTop');
      if (btn) {
        const orig = btn.innerHTML;
        btn.innerHTML = '⏳ Saving...';
        btn.disabled = true;
        setTimeout(()=>{
          try {
            if (typeof saveState === 'function') saveState();
            try { localStorage.setItem('schoolMasterTimetable', JSON.stringify(state)); } catch(e){}
            if (typeof autosaveNow === 'function') autosaveNow();
            else if (typeof showToast === 'function') showToast('✓ Timetable saved successfully');
            if (typeof markTimetableSaved === 'function') markTimetableSaved();
            btn.innerHTML = '✅ Saved';
            setTimeout(()=>{ btn.innerHTML = orig; btn.disabled = false; }, 1500);
          } catch(err){
            console.error(err);
            lastSaveFailed = true;
            if (typeof updateDirtyIndicator === 'function') updateDirtyIndicator();
            if (typeof showToast === 'function') showToast('❌ Save failed: '+err.message);
            btn.innerHTML = orig;
            btn.disabled = false;
          }
        }, 300);
      } else {
        try { 
          if (typeof saveState === 'function') saveState();
          localStorage.setItem('schoolMasterTimetable', JSON.stringify(state)); 
          showToast('✓ Saved'); 
        } catch(e){ showToast('Save failed'); }
      }
    }

function switchView(view) {
      state.currentView = view;
      document.querySelectorAll('.view-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.view === view);
      });

      const controls = document.getElementById('viewControls');
      const title = document.getElementById('viewTitle');
      const legend = document.getElementById('legendArea');
      const conflictsCard = document.getElementById('conflictsCard');

      // Side by Side: keep Settings + Subjects collapsed (user can expand via headers)
      if (view === 'compare') {
        setSidebarCardCollapsed('settingsCard', true);
        setSidebarCardCollapsed('subjectsCard', true);
      }

      if (view === 'school') {
        title.textContent = 'School General Timetable';
        controls.innerHTML = buildClearControlsHtml();
        legend.innerHTML = '<span class="legend-item"><span class="legend-box" style="background:#fef2f2;border:2px solid #f87171;"></span> Teacher clash</span> <span class="legend-item"><span class="legend-box" style="background:#f1f5f9;border:1px dashed #94a3b8;"></span> Break</span> <span class="legend-item">Clear allotted subjects per class above</span>';
        conflictsCard.style.display = 'block';
        updateConflicts();
        setTimeout(initClearSubjectPicker, 0);
      } else if (view === 'class') {
        if (state.selectedClassId) {
          const c = state.classes.find(x => x.id === state.selectedClassId);
          const main = 'Class Timetable — ' + (c ? c.name : '');
          if (state.showClassLoad !== false) {
            setViewTitle(main, false, getClassPeriodTotals(state.selectedClassId));
          } else {
            title.textContent = main;
          }
        } else {
          title.textContent = 'Select a class';
        }
        controls.innerHTML = buildClassPickerHtml();
        legend.innerHTML = '<span class="legend-item"><span class="legend-box" style="background:#fef2f2;border:2px solid #f87171;"></span> Clash</span> <span class="legend-item">Click cells to add or change subjects</span> <span class="legend-item">Toggle subject load above</span>';
        conflictsCard.style.display = 'block';
        updateConflicts();
        setTimeout(initClassPicker, 0);
      } else if (view === 'teacher') {
        if (state.selectedTeacher) {
          const main = 'Teacher Timetable — ' + state.selectedTeacher;
          if (state.showTeacherLoad !== false) {
            setViewTitle(main, false, getTeacherPeriodTotals(state.selectedTeacher));
          } else {
            title.textContent = main;
          }
        } else {
          title.textContent = 'Select a teacher';
        }
        controls.innerHTML = buildTeacherPickerHtml(false);
        legend.innerHTML = '<span class="legend-item"><span class="legend-box" style="background:#fef2f2;border:2px solid #f87171;"></span> Clash</span> <span class="legend-item">Click cells to add or change</span> <span class="legend-item">Toggle subject load above</span>';
        conflictsCard.style.display = 'block';
        updateConflicts();
        setTimeout(initTeacherPicker, 0);
      } else if (view === 'compare') {
        title.textContent = 'Side by Side — School & Teacher';
        controls.innerHTML = buildTeacherPickerHtml(true);
        legend.innerHTML = '<span class="legend-item">Left: School General (edit) · Right: Teacher (edit)</span> <span class="legend-item"><span class="legend-box" style="background:#fef2f2;border:2px solid #f87171;"></span> Clash</span>';
        conflictsCard.style.display = 'block';
        updateConflicts();
        setTimeout(initTeacherPicker, 0);
      } else if (view === 'exam') {
        title.textContent = 'Exam / CA Timetable';
        controls.innerHTML = '<button class="btn btn-primary btn-sm" onclick="autoGenerateExamTimetable()">📝 Auto-generate Exam/CA</button>' +
          '<button class="btn btn-danger btn-sm" onclick="clearExams()">Clear exams</button>';
        legend.innerHTML = '<span class="legend-item">Invigilator watches the class · Supervisor oversees each arm</span> <span class="legend-item">Click cells to schedule</span>';
        conflictsCard.style.display = 'block';
        updateExamConflicts();
      } else if (view === 'study') {
        const placed = (state.studyAssignments || []).length;
        const need = (state.studySubjects || []).reduce(function (s, x) { return s + (x.periods || 0); }, 0);
        title.textContent = 'Personal Reading / Study Timetable' +
          (need ? (' · ' + placed + '/' + need + ' periods') : '');
        controls.innerHTML =
          '<button class="btn btn-primary btn-sm" onclick="autoGenerateStudyTimetable()">✨ Auto-generate study plan</button>' +
          '<button class="btn btn-danger btn-sm" onclick="clearStudyAssignments()">Clear study grid</button>';
        legend.innerHTML = '<span class="legend-item">Your personal reading plan</span> <span class="legend-item">Add study subjects in Setup, set periods/week, then auto-generate</span> <span class="legend-item">Click a cell to place or change a subject</span>';
        conflictsCard.style.display = 'none';
        if (typeof syncStudySlotModeUi === 'function') syncStudySlotModeUi();
        if (typeof renderStudySubjects === 'function') renderStudySubjects();
      }
      renderTable();
    }

    function onClassSelect(id) {
      state.selectedClassId = id || null;
      renderTable();
      updatePeriodLoadTitle();
    }

    function toggleClassLoadDisplay() {
      state.showClassLoad = !(state.showClassLoad !== false);
      const btn = document.getElementById('btnToggleClassLoad');
      if (btn) {
        btn.textContent = state.showClassLoad !== false ? '📊 Load: On' : '📊 Load: Off';
        btn.classList.toggle('btn-primary', state.showClassLoad !== false);
        btn.classList.toggle('btn-secondary', state.showClassLoad === false);
      }
      updatePeriodLoadTitle();
      try { localStorage.setItem('schoolMasterTimetable', JSON.stringify(state)); } catch (e) {}
    }

    function toggleTeacherLoadDisplay() {
      state.showTeacherLoad = !(state.showTeacherLoad !== false);
      const btn = document.getElementById('btnToggleTeacherLoad');
      if (btn) {
        btn.textContent = state.showTeacherLoad !== false ? '📊 Load: On' : '📊 Load: Off';
        btn.classList.toggle('btn-primary', state.showTeacherLoad !== false);
        btn.classList.toggle('btn-secondary', state.showTeacherLoad === false);
      }
      updatePeriodLoadTitle();
      try { localStorage.setItem('schoolMasterTimetable', JSON.stringify(state)); } catch (e) {}
    }

    function buildClassPickerHtml() {
      const loadOn = state.showClassLoad !== false;
      const sel = state.classes.find(c => c.id === state.selectedClassId);
      const label = sel ? sel.name : '';
      const idx = state.classes.findIndex(c => c.id === state.selectedClassId);
      const isFirst = idx <= 0;
      const isLast = idx === -1 ? true : idx >= state.classes.length - 1;
      const hasClasses = state.classes.length > 0;
      const noSelection = !state.selectedClassId;
      return (
        '<label>Select Class:</label>' +
        '<div class="combo-box teacher-combo" id="classCombo">' +
          '<input type="hidden" id="classSelect" value="' + escapeHtml(state.selectedClassId || '') + '" />' +
          '<input type="text" id="classComboInput" class="combo-input" placeholder="Type or choose class…" ' +
            'value="' + escapeHtml(label) + '" autocomplete="off" spellcheck="false" />' +
          '<button type="button" class="combo-toggle" id="classComboToggle" tabindex="-1" aria-label="Open class list">▼</button>' +
        '</div>' +
        '<div class="class-nav-group" style="display:inline-flex;gap:3px;align-items:center;">' +
          '<button type="button" class="btn btn-secondary btn-sm" id="btnPrevClass" onclick="navigateClass(-1)" title="Previous class" ' + (!hasClasses || isFirst || noSelection ? 'disabled' : '') + '>◀ Prev</button>' +
          '<button type="button" class="btn btn-secondary btn-sm" id="btnNextClass" onclick="navigateClass(1)" title="Next class" ' + (!hasClasses || isLast || noSelection ? 'disabled' : '') + '>Next ▶</button>' +
        '</div>' +
        '<button type="button" class="btn ' + (loadOn ? 'btn-primary' : 'btn-secondary') + ' btn-sm" id="btnToggleClassLoad" ' +
          'onclick="toggleClassLoadDisplay()" title="Show or hide remaining subject load chips">' +
          (loadOn ? '📊 Load: On' : '📊 Load: Off') + '</button>'
      );
    }

    function navigateClass(dir) {
      if (!state.classes.length) return;
      let idx = state.classes.findIndex(c => c.id === state.selectedClassId);
      if (idx === -1) {
        idx = dir > 0 ? -1 : 1;
      }
      let newIdx = idx + dir;
      if (newIdx < 0) newIdx = 0;
      if (newIdx >= state.classes.length) newIdx = state.classes.length - 1;
      if (newIdx === idx) return;
      const nextClass = state.classes[newIdx];
      if (!nextClass) return;
      onClassSelect(nextClass.id);
      // Update combo input immediately without full re-init if possible
      const hidden = document.getElementById('classSelect');
      const input = document.getElementById('classComboInput');
      if (hidden) hidden.value = nextClass.id;
      if (input) input.value = nextClass.name;
    }

    function initClassPicker() {
      initClassCombo();
    }

    function initClassCombo() {
      const hidden = document.getElementById('classSelect');
      const input = document.getElementById('classComboInput');
      const toggle = document.getElementById('classComboToggle');
      const box = document.getElementById('classCombo');
      if (!hidden || !input || !toggle || !box) return;

      if (window._classComboPortal) {
        window._classComboPortal.remove();
        window._classComboPortal = null;
      }

      const options = state.classes.map(c => ({ value: c.id, label: c.name }));
      let open = false;
      let highlight = -1;

      const current = options.find(o => o.value === state.selectedClassId);
      hidden.value = state.selectedClassId || '';
      input.value = current ? current.label : '';

      const portal = document.createElement('ul');
      portal.className = 'combo-portal-list';
      portal.style.display = 'none';
      document.body.appendChild(portal);
      window._classComboPortal = portal;

      function filtered() {
        const q = (input.value || '').toLowerCase().trim();
        if (hidden.value) {
          const sel = options.find(o => o.value === hidden.value);
          if (sel && input.value === sel.label) return options.slice();
        }
        if (!q) return options.slice();
        return options.filter(o => o.label.toLowerCase().indexOf(q) !== -1);
      }

      function placePortal() {
        const rect = input.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const width = Math.min(Math.max(rect.width, 180), vw - 16);
        let left = rect.left;
        if (left + width > vw - 8) left = Math.max(8, vw - 8 - width);
        if (left < 8) left = 8;
        const maxH = Math.min(280, Math.max(100, vh - rect.bottom - 8));
        portal.style.left = left + 'px';
        portal.style.top = (rect.bottom + 2) + 'px';
        portal.style.width = width + 'px';
        portal.style.maxHeight = maxH + 'px';
      }

      function renderPortal() {
        const items = filtered();
        if (!items.length) {
          portal.innerHTML = '<li class="combo-empty">No matches</li>';
        } else {
          portal.innerHTML = items.map((o, i) =>
            '<li data-value="' + escapeHtml(o.value) + '" data-label="' + escapeHtml(o.label) + '"' +
            (i === highlight ? ' class="highlight"' : '') + '>' + escapeHtml(o.label) + '</li>'
          ).join('');
        }
      }

      function openList() {
        open = true;
        highlight = 0;
        renderPortal();
        placePortal();
        portal.style.display = 'block';
        toggle.textContent = '▲';
      }

      function closeList(restore) {
        open = false;
        portal.style.display = 'none';
        toggle.textContent = '▼';
        if (restore !== false) {
          const sel = options.find(o => o.value === hidden.value);
          input.value = sel ? sel.label : '';
        }
      }

      function selectOpt(value, label) {
        hidden.value = value || '';
        input.value = label || '';
        closeList(false);
        onClassSelect(value || null);
      }

      input.onfocus = function () { 
        openList(); 
        setTimeout(function(){ try{ input.select(); }catch(e){} }, 15);
      };
      input.onclick = function () { 
        openList(); 
        setTimeout(function(){ try{ input.select(); }catch(e){} }, 15);
      };
      input.oninput = function () {
        const match = options.find(o => o.label.toLowerCase() === (input.value || '').toLowerCase());
        if (match) hidden.value = match.value;
        else {
          const sel = options.find(o => o.value === hidden.value);
          if (!sel || input.value !== sel.label) hidden.value = '';
        }
        openList();
      };
      input.onkeydown = function (e) {
        const items = filtered();
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (!open) openList();
          highlight = Math.min(highlight + 1, items.length - 1);
          renderPortal();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          highlight = Math.max(highlight - 1, 0);
          renderPortal();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (open && items[highlight]) selectOpt(items[highlight].value, items[highlight].label);
          else if (items.length === 1) selectOpt(items[0].value, items[0].label);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          closeList(true);
          input.blur();
        }
      };

      toggle.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (open) closeList(true);
        else { input.focus(); openList(); }
      };

      portal.onmousedown = function (e) { e.preventDefault(); };
      portal.onclick = function (e) {
        const li = e.target.closest('li[data-value]');
        if (!li) return;
        selectOpt(li.getAttribute('data-value'), li.getAttribute('data-label'));
      };

      if (!window._classComboDocBound) {
        window._classComboDocBound = true;
        document.addEventListener('click', function (ev) {
          if (!window._classComboPortal || window._classComboPortal.style.display === 'none') return;
          const boxEl = document.getElementById('classCombo');
          if (boxEl && (boxEl.contains(ev.target) || window._classComboPortal.contains(ev.target))) return;
          const hid = document.getElementById('classSelect');
          const inp = document.getElementById('classComboInput');
          const tog = document.getElementById('classComboToggle');
          if (hid && inp && tog) {
            const sel = state.classes.find(c => c.id === hid.value);
            inp.value = sel ? sel.name : '';
            window._classComboPortal.style.display = 'none';
            tog.textContent = '▼';
          }
        });
        window.addEventListener('scroll', function () {
          if (window._classComboPortal && window._classComboPortal.style.display !== 'none') {
            const inp = document.getElementById('classComboInput');
            if (!inp) return;
            const rect = inp.getBoundingClientRect();
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const width = Math.min(Math.max(rect.width, 180), vw - 16);
            let left = rect.left;
            if (left + width > vw - 8) left = Math.max(8, vw - 8 - width);
            if (left < 8) left = 8;
            window._classComboPortal.style.left = left + 'px';
            window._classComboPortal.style.top = (rect.bottom + 2) + 'px';
            window._classComboPortal.style.width = width + 'px';
            window._classComboPortal.style.maxHeight = Math.min(280, Math.max(100, vh - rect.bottom - 8)) + 'px';
          }
        }, true);
        window.addEventListener('resize', function () {
          if (window._classComboPortal) window._classComboPortal.style.display = 'none';
        });
      }
    }

    /** School General: Clear class + optional subject (searchable comboboxes) */
    function buildClearControlsHtml() {
      return (
        '<label>Clear:</label>' +
        '<div class="combo-box clear-class-combo" id="clearClassCombo">' +
          '<input type="hidden" id="clearClassSelect" value="" />' +
          '<input type="text" id="clearClassComboInput" class="combo-input" placeholder="-- Class --" autocomplete="off" spellcheck="false" />' +
          '<button type="button" class="combo-toggle" id="clearClassComboToggle" tabindex="-1">\u25BC</button>' +
        '</div>' +
        '<div class="combo-box clear-subject-combo" id="clearSubjectCombo">' +
          '<input type="hidden" id="clearSubjectSelect" value="" />' +
          '<input type="text" id="clearSubjectComboInput" class="combo-input" placeholder="All subjects (optional)" autocomplete="off" spellcheck="false" />' +
          '<button type="button" class="combo-toggle" id="clearSubjectComboToggle" tabindex="-1">\u25BC</button>' +
        '</div>' +
        '<button class="btn btn-danger btn-sm" onclick="clearAllottedForClass()">Clear allotted</button>' +
        '<button class="btn btn-danger btn-sm" onclick="clearTeachingTimetable()">Clear all cells</button>'
      );
    }

    function initClearClassCombo(){
      const hidden = document.getElementById('clearClassSelect');
      const input = document.getElementById('clearClassComboInput');
      const toggle = document.getElementById('clearClassComboToggle');
      const box = document.getElementById('clearClassCombo');
      if (!hidden || !input || !toggle || !box) return;
      if (window._clearClassPortal) { window._clearClassPortal.remove(); window._clearClassPortal=null; }
      const portal = document.createElement('ul');
      portal.className = 'combo-portal-list';
      portal.style.display='none';
      document.body.appendChild(portal);
      window._clearClassPortal = portal;
      let open=false, hl=-1;
      function getOpts(){
        const list = [{value:'', label:'-- Class --'}];
        (state.classes||[]).forEach(c=> list.push({value:c.id, label:c.name}));
        return list;
      }
      function filtered(){
        const q=(input.value||'').toLowerCase().trim();
        const all=getOpts();
        if(hidden.value){
          const sel=all.find(o=> o.value===hidden.value);
          if(sel && input.value===sel.label) return all;
        }
        if(!q) return all;
        return all.filter(o=> o.label.toLowerCase().indexOf(q)!==-1);
      }
      function place(){
        const rect=input.getBoundingClientRect();
        const vw=window.innerWidth, vh=window.innerHeight;
        const width=Math.min(Math.max(rect.width,180), vw-16);
        let left=rect.left;
        if(left+width>vw-8) left=Math.max(8,vw-8-width);
        portal.style.left=left+'px';
        portal.style.top=(rect.bottom+2)+'px';
        portal.style.width=width+'px';
        portal.style.maxHeight=Math.min(280, Math.max(100, vh-rect.bottom-8))+'px';
      }
      function render(){
        const items=filtered();
        if(!items.length) portal.innerHTML='<li class="combo-empty">No matches</li>';
        else portal.innerHTML=items.map((o,i)=> '<li data-value="'+escapeHtml(o.value)+'" data-label="'+escapeHtml(o.label)+'"'+(i===hl?' class="highlight"':'')+'>'+escapeHtml(o.label)+'</li>').join('');
      }
      function openList(){
        open=true; hl=0; render(); place(); portal.style.display='block'; toggle.textContent='\u25B2';
      }
      function closeList(restore){
        open=false; portal.style.display='none'; toggle.textContent='\u25BC';
        if(restore!==false){ 
          const all=getOpts();
          const sel=all.find(o=> o.value===hidden.value);
          input.value = sel && sel.value ? sel.label : '';
        }
      }
      function selectOpt(v,l){
        hidden.value=v||''; input.value=l && v ? l : ''; closeList(false);
      }
      input.onfocus=function(){ openList(); setTimeout(function(){ try{ input.select(); }catch(e){} },15); };
      input.onclick=function(){ openList(); };
      input.oninput=function(){
        const all=getOpts();
        const match=all.find(o=> o.label.toLowerCase()=== (input.value||'').toLowerCase());
        if(match) hidden.value=match.value;
        else { const sel=all.find(o=> o.value===hidden.value); if(!sel || input.value!==sel.label) hidden.value=''; }
        openList();
      };
      input.onkeydown=function(e){
        const items=filtered();
        if(e.key==='ArrowDown'){ e.preventDefault(); if(!open) openList(); hl=Math.min(hl+1,items.length-1); render(); }
        else if(e.key==='ArrowUp'){ e.preventDefault(); hl=Math.max(hl-1,0); render(); }
        else if(e.key==='Enter'){ e.preventDefault(); if(open && items[hl]) selectOpt(items[hl].value, items[hl].label); else if(items.length===1) selectOpt(items[0].value, items[0].label); }
        else if(e.key==='Escape'){ e.preventDefault(); closeList(true); input.blur(); }
      };
      toggle.onclick=function(e){ e.preventDefault(); e.stopPropagation(); if(open) closeList(true); else { input.focus(); openList(); } };
      portal.onmousedown=function(e){ e.preventDefault(); };
      portal.onclick=function(e){
        const li=e.target.closest('li[data-value]');
        if(!li) return;
        selectOpt(li.getAttribute('data-value'), li.getAttribute('data-label'));
      };
    }

    function initClearSubjectCombo(){
      const hidden = document.getElementById('clearSubjectSelect');
      const input = document.getElementById('clearSubjectComboInput');
      const toggle = document.getElementById('clearSubjectComboToggle');
      const box = document.getElementById('clearSubjectCombo');
      if (!hidden || !input || !toggle || !box) return;
      if (window._clearSubjectPortal) { window._clearSubjectPortal.remove(); window._clearSubjectPortal=null; }
      const portal = document.createElement('ul');
      portal.className = 'combo-portal-list';
      portal.style.display='none';
      document.body.appendChild(portal);
      window._clearSubjectPortal = portal;
      let open=false, hl=-1;
      function getOpts(){
        const list = [{value:'', label:'All subjects'}];
        (state.subjects||[]).forEach(s=> list.push({value:s.id, label:s.name + (s.teacher?' ('+s.teacher+')':'')}));
        return list;
      }
      function filtered(){
        const q=(input.value||'').toLowerCase().trim();
        const all=getOpts();
        if(hidden.value){
          const sel=all.find(o=> o.value===hidden.value);
          if(sel && input.value===sel.label) return all;
        }
        if(!q) return all;
        return all.filter(o=> o.label.toLowerCase().indexOf(q)!==-1);
      }
      function place(){
        const rect=input.getBoundingClientRect();
        const vw=window.innerWidth, vh=window.innerHeight;
        const width=Math.min(Math.max(rect.width,180), vw-16);
        let left=rect.left;
        if(left+width>vw-8) left=Math.max(8,vw-8-width);
        portal.style.left=left+'px';
        portal.style.top=(rect.bottom+2)+'px';
        portal.style.width=width+'px';
        portal.style.maxHeight=Math.min(280, Math.max(100, vh-rect.bottom-8))+'px';
      }
      function render(){
        const items=filtered();
        if(!items.length) portal.innerHTML='<li class="combo-empty">No matches</li>';
        else portal.innerHTML=items.map((o,i)=> '<li data-value="'+escapeHtml(o.value)+'" data-label="'+escapeHtml(o.label)+'"'+(i===hl?' class="highlight"':'')+'>'+escapeHtml(o.label)+'</li>').join('');
      }
      function openList(){
        open=true; hl=0; render(); place(); portal.style.display='block'; toggle.textContent='\u25B2';
      }
      function closeList(restore){
        open=false; portal.style.display='none'; toggle.textContent='\u25BC';
        if(restore!==false){
          const all=getOpts();
          const sel=all.find(o=> o.value===hidden.value);
          input.value = sel && sel.value ? sel.label : '';
        }
      }
      function selectOpt(v,l){
        hidden.value=v||''; 
        if(v==='') input.value='';
        else input.value=l||'';
        closeList(false);
      }
      input.onfocus=function(){ openList(); setTimeout(function(){ try{ input.select(); }catch(e){} },15); };
      input.onclick=function(){ openList(); };
      input.oninput=function(){
        const all=getOpts();
        const match=all.find(o=> o.label.toLowerCase()=== (input.value||'').toLowerCase());
        if(match) hidden.value=match.value;
        else { const sel=all.find(o=> o.value===hidden.value); if(!sel || input.value!==sel.label) hidden.value=''; if((input.value||'').trim()==='') hidden.value=''; }
        openList();
      };
      input.onkeydown=function(e){
        const items=filtered();
        if(e.key==='ArrowDown'){ e.preventDefault(); if(!open) openList(); hl=Math.min(hl+1,items.length-1); render(); }
        else if(e.key==='ArrowUp'){ e.preventDefault(); hl=Math.max(hl-1,0); render(); }
        else if(e.key==='Enter'){ e.preventDefault(); if(open && items[hl]) selectOpt(items[hl].value, items[hl].label); else if(items.length===1) selectOpt(items[0].value, items[0].label); }
        else if(e.key==='Escape'){ e.preventDefault(); closeList(true); input.blur(); }
      };
      toggle.onclick=function(e){ e.preventDefault(); e.stopPropagation(); if(open) closeList(true); else { input.focus(); openList(); } };
      portal.onmousedown=function(e){ e.preventDefault(); };
      portal.onclick=function(e){
        const li=e.target.closest('li[data-value]');
        if(!li) return;
        selectOpt(li.getAttribute('data-value'), li.getAttribute('data-label'));
      };
    }

    function initClearSubjectPicker(){
      initClearClassCombo();
      initClearSubjectCombo();
    }

    // Close clear combos when clicking outside (like teacher combo)
    if (!window._clearCombosDocBound){
      window._clearCombosDocBound=true;
      document.addEventListener('click', function(ev){
        ['_clearClassPortal','_clearSubjectPortal'].forEach(key=>{
          const portal=window[key];
          if(!portal || portal.style.display==='none') return;
          const boxId = key==='_clearClassPortal' ? 'clearClassCombo' : 'clearSubjectCombo';
          const boxEl=document.getElementById(boxId);
          if(boxEl && (boxEl.contains(ev.target) || portal.contains(ev.target))) return;
          portal.style.display='none';
          const togId = key==='_clearClassPortal' ? 'clearClassComboToggle' : 'clearSubjectComboToggle';
          const tog=document.getElementById(togId);
          if(tog) tog.textContent='\u25BC';
          // restore input to hidden value
          const hidId = key==='_clearClassPortal' ? 'clearClassSelect' : 'clearSubjectSelect';
          const inpId = key==='_clearClassPortal' ? 'clearClassComboInput' : 'clearSubjectComboInput';
          const hid=document.getElementById(hidId);
          const inp=document.getElementById(inpId);
          if(hid && inp){
            if(hid.value){
              const isClass = key==='_clearClassPortal';
              let label='';
              if(isClass){ const c=(state.classes||[]).find(x=> x.id===hid.value); label=c?c.name:''; }
              else { const s=(state.subjects||[]).find(x=> x.id===hid.value); label=s? (s.name + (s.teacher?' ('+s.teacher+')':'')):''; }
              inp.value=label;
            } else inp.value='';
          }
        });
      });
    }

    function onTeacherSelect(name) {
      state.selectedTeacher = name || null;
      const label = document.getElementById('compareTeacherLabel');
      if (label) {
        label.textContent = name
          ? (name + ' · click cells to edit')
          : 'Select a teacher · click cells to edit';
      }
      const hidden = document.getElementById('teacherSelect');
      if (hidden) hidden.value = name || '';
      const input = document.getElementById('teacherComboInput');
      if (input) input.value = name || '';
      renderTable();
    }

    /** Single teacher combobox (search + dropdown in one bar) + Prev/Next */
    function buildTeacherPickerHtml(withCycle) {
      const loadOn = state.showTeacherLoad !== false;
      const teachers = (typeof getUniqueTeachers === 'function') ? getUniqueTeachers() : [];
      const idx = teachers.findIndex(t => t === state.selectedTeacher);
      const hasTeachers = teachers.length > 0;
      const noSelection = !state.selectedTeacher;
      const isFirst = idx <= 0;
      const isLast = idx === -1 ? true : idx >= teachers.length - 1;
      let html =
        '<label>Select Teacher:</label>' +
        '<div class="combo-box teacher-combo" id="teacherCombo">' +
          '<input type="hidden" id="teacherSelect" value="' + escapeHtml(state.selectedTeacher || '') + '" />' +
          '<input type="text" id="teacherComboInput" class="combo-input" placeholder="Type or choose teacher…" ' +
            'value="' + escapeHtml(state.selectedTeacher || '') + '" autocomplete="off" spellcheck="false" />' +
          '<button type="button" class="combo-toggle" id="teacherComboToggle" tabindex="-1" aria-label="Open teacher list">▼</button>' +
        '</div>' +
        '<div class="teacher-nav-group" style="display:inline-flex;gap:3px;align-items:center;">' +
          '<button type="button" class="btn btn-secondary btn-sm" id="btnPrevTeacher" onclick="navigateTeacher(-1)" title="Previous teacher" ' +
            (!hasTeachers || isFirst || noSelection ? 'disabled' : '') + '>◀ Prev</button>' +
          '<button type="button" class="btn btn-secondary btn-sm" id="btnNextTeacher" onclick="navigateTeacher(1)" title="Next teacher" ' +
            (!hasTeachers || isLast || noSelection ? 'disabled' : '') + '>Next ▶</button>' +
        '</div>';
      if (!withCycle) {
        html +=
          '<button type="button" class="btn ' + (loadOn ? 'btn-primary' : 'btn-secondary') + ' btn-sm" id="btnToggleTeacherLoad" ' +
            'onclick="toggleTeacherLoadDisplay()" title="Show or hide remaining subject load chips">' +
            (loadOn ? '📊 Load: On' : '📊 Load: Off') + '</button>';
      }
      return html;
    }

    function navigateTeacher(dir) {
      const teachers = (typeof getUniqueTeachers === 'function') ? getUniqueTeachers() : [];
      if (!teachers.length) {
        showToast('No teachers yet');
        return;
      }
      let idx = teachers.findIndex(t => t === state.selectedTeacher);
      if (idx === -1) {
        idx = dir > 0 ? -1 : 1;
      }
      let newIdx = idx + dir;
      if (newIdx < 0) newIdx = 0;
      if (newIdx >= teachers.length) newIdx = teachers.length - 1;
      if (newIdx === idx) return;
      const name = teachers[newIdx];
      if (!name) return;
      onTeacherSelect(name);
      // Refresh disabled state on nav buttons without full controls rebuild
      const prevBtn = document.getElementById('btnPrevTeacher');
      const nextBtn = document.getElementById('btnNextTeacher');
      if (prevBtn) prevBtn.disabled = newIdx <= 0;
      if (nextBtn) nextBtn.disabled = newIdx >= teachers.length - 1;
    }

    function initTeacherPicker() {
      initTeacherCombo();
    }

    function initTeacherCombo() {
      const hidden = document.getElementById('teacherSelect');
      const input = document.getElementById('teacherComboInput');
      const toggle = document.getElementById('teacherComboToggle');
      const box = document.getElementById('teacherCombo');
      if (!hidden || !input || !toggle || !box) return;

      if (window._teacherComboPortal) {
        window._teacherComboPortal.remove();
        window._teacherComboPortal = null;
      }

      const options = getUniqueTeachers().map(t => ({ value: t, label: t }));
      let open = false;
      let highlight = -1;

      hidden.value = state.selectedTeacher || '';
      input.value = state.selectedTeacher || '';

      const portal = document.createElement('ul');
      portal.className = 'combo-portal-list';
      portal.style.display = 'none';
      document.body.appendChild(portal);
      window._teacherComboPortal = portal;

      function filtered() {
        const q = (input.value || '').toLowerCase().trim();
        if (hidden.value) {
          const sel = options.find(o => o.value === hidden.value);
          if (sel && input.value === sel.label) return options.slice();
        }
        if (!q) return options.slice();
        return options.filter(o => o.label.toLowerCase().indexOf(q) !== -1);
      }

      function placePortal() {
        const rect = input.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const width = Math.min(Math.max(rect.width, 180), vw - 16);
        let left = rect.left;
        if (left + width > vw - 8) left = Math.max(8, vw - 8 - width);
        if (left < 8) left = 8;
        const maxH = Math.min(280, Math.max(100, vh - rect.bottom - 8));
        portal.style.left = left + 'px';
        portal.style.top = (rect.bottom + 2) + 'px';
        portal.style.width = width + 'px';
        portal.style.maxHeight = maxH + 'px';
      }

      function renderPortal() {
        const items = filtered();
        if (!items.length) {
          portal.innerHTML = '<li class="combo-empty">No matches</li>';
        } else {
          portal.innerHTML = items.map((o, i) =>
            '<li data-value="' + escapeHtml(o.value) + '" data-label="' + escapeHtml(o.label) + '"' +
            (i === highlight ? ' class="highlight"' : '') + '>' + escapeHtml(o.label) + '</li>'
          ).join('');
        }
      }

      function openList() {
        open = true;
        highlight = 0;
        renderPortal();
        placePortal();
        portal.style.display = 'block';
        toggle.textContent = '▲';
      }

      function closeList(restore) {
        open = false;
        portal.style.display = 'none';
        toggle.textContent = '▼';
        if (restore !== false) {
          input.value = hidden.value || '';
        }
      }

      function selectOpt(value, label) {
        hidden.value = value || '';
        input.value = label || '';
        closeList(false);
        onTeacherSelect(value || null);
      }

      input.onfocus = function () { 
        openList(); 
        setTimeout(function(){ try{ input.select(); }catch(e){} }, 15);
      };
      input.onclick = function () { 
        openList(); 
        setTimeout(function(){ try{ input.select(); }catch(e){} }, 15);
      };
      input.oninput = function () {
        const match = options.find(o => o.label.toLowerCase() === (input.value || '').toLowerCase());
        if (match) hidden.value = match.value;
        else {
          const sel = options.find(o => o.value === hidden.value);
          if (!sel || input.value !== sel.label) hidden.value = '';
        }
        openList();
      };
      input.onkeydown = function (e) {
        const items = filtered();
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (!open) openList();
          highlight = Math.min(highlight + 1, items.length - 1);
          renderPortal();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          highlight = Math.max(highlight - 1, 0);
          renderPortal();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (open && items[highlight]) selectOpt(items[highlight].value, items[highlight].label);
          else if (items.length === 1) selectOpt(items[0].value, items[0].label);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          closeList(true);
          input.blur();
        }
      };

      toggle.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (open) closeList(true);
        else { input.focus(); openList(); }
      };

      portal.onmousedown = function (e) { e.preventDefault(); };
      portal.onclick = function (e) {
        const li = e.target.closest('li[data-value]');
        if (!li) return;
        selectOpt(li.getAttribute('data-value'), li.getAttribute('data-label'));
      };

      if (!window._teacherComboDocBound) {
        window._teacherComboDocBound = true;
        document.addEventListener('click', function (ev) {
          if (!window._teacherComboPortal || window._teacherComboPortal.style.display === 'none') return;
          const boxEl = document.getElementById('teacherCombo');
          if (boxEl && (boxEl.contains(ev.target) || window._teacherComboPortal.contains(ev.target))) return;
          const hid = document.getElementById('teacherSelect');
          const inp = document.getElementById('teacherComboInput');
          if (inp && hid) inp.value = hid.value || '';
          window._teacherComboPortal.style.display = 'none';
          const tog = document.getElementById('teacherComboToggle');
          if (tog) tog.textContent = '▼';
        });
        window.addEventListener('resize', function () {
          if (window._teacherComboPortal && window._teacherComboPortal.style.display !== 'none') {
            const inp = document.getElementById('teacherComboInput');
            if (!inp) return;
            const rect = inp.getBoundingClientRect();
            const vw = window.innerWidth;
            const width = Math.min(Math.max(rect.width, 180), vw - 16);
            let left = rect.left;
            if (left + width > vw - 8) left = Math.max(8, vw - 8 - width);
            window._teacherComboPortal.style.left = left + 'px';
            window._teacherComboPortal.style.top = (rect.bottom + 2) + 'px';
            window._teacherComboPortal.style.width = width + 'px';
          }
        });
      }
    }

    function cycleCompareTeacher(dir) {
      // Same as navigateTeacher (kept for older onclick bindings)
      navigateTeacher(dir);
    }

    /** Collapse left School pane so Teacher view uses full width (magnified). */
    function toggleCompareSchoolPane() {
      const layout = document.getElementById('compareLayout');
      if (!layout) return;
      const collapsed = layout.classList.toggle('school-collapsed');
      state.compareSchoolCollapsed = collapsed;
      const btnHide = document.getElementById('btnCollapseSchool');
      const btnShow = document.getElementById('btnShowSchool');
      if (btnHide) btnHide.style.display = collapsed ? 'none' : '';
      if (btnShow) btnShow.style.display = collapsed ? '' : 'none';
      showToast(collapsed ? 'School grid hidden — teacher view enlarged' : 'School grid shown');
    }

    function applyCompareSchoolCollapse() {
      const layout = document.getElementById('compareLayout');
      if (!layout) return;
      const collapsed = !!state.compareSchoolCollapsed;
      layout.classList.toggle('school-collapsed', collapsed);
      const btnHide = document.getElementById('btnCollapseSchool');
      const btnShow = document.getElementById('btnShowSchool');
      if (btnHide) btnHide.style.display = collapsed ? 'none' : '';
      if (btnShow) btnShow.style.display = collapsed ? '' : 'none';
    }

    function getUniqueTeachers() {
      const set = new Set();
      state.subjects.forEach(s => { if (s.teacher && s.teacher.trim()) set.add(s.teacher.trim()); });
      return Array.from(set).sort((a, b) => a.localeCompare(b));
    }

    /**
     * Build HTML for a searchable dropdown.
     * options: [{ value, label }]
     * emptyLabel: shown for the empty/all option (value '')
     * selectedValue: current value
     * onChangeAttr: e.g. 'onTeacherSelect' — called as window[fn](value) when selection changes
     * Returns markup; call initSearchableSelect(id) after inserting into DOM.
     */
    function buildSearchableSelectHtml(id, options, emptyLabel, selectedValue, onChangeAttr) {
      emptyLabel = emptyLabel || '— Choose —';
      selectedValue = selectedValue == null ? '' : String(selectedValue);
      let selectedLabel = emptyLabel;
      const optsHtml = [{ value: '', label: emptyLabel }].concat(options || []).map(o => {
        const v = String(o.value);
        const lab = o.label;
        if (v === selectedValue) selectedLabel = lab;
        return '<li data-value="' + escapeHtml(v) + '" data-label="' + escapeHtml(lab) + '">' + escapeHtml(lab) + '</li>';
      }).join('');
      return (
        '<div class="searchable-select" id="ss-wrap-' + id + '" data-onchange="' + escapeHtml(onChangeAttr || '') + '">' +
          '<input type="hidden" id="' + id + '" value="' + escapeHtml(selectedValue) + '" class="ss-hidden" />' +
          '<input type="text" class="ss-input" id="ss-input-' + id + '" value="' + escapeHtml(selectedLabel) + '" ' +
            'placeholder="Search…" autocomplete="off" spellcheck="false" />' +
          '<span class="ss-chevron">▼</span>' +
          '<ul class="ss-list" id="ss-list-' + id + '">' + optsHtml + '</ul>' +
        '</div>'
      );
    }

    function initSearchableSelect(id) {
      const wrap = document.getElementById('ss-wrap-' + id);
      if (!wrap || wrap.dataset.ssInit === '1') return;
      wrap.dataset.ssInit = '1';
      const hidden = document.getElementById(id);
      const input = document.getElementById('ss-input-' + id);
      const list = document.getElementById('ss-list-' + id);
      if (!hidden || !input || !list) return;

      const onChangeName = wrap.dataset.onchange || '';
      let highlightIdx = -1;

      function allItems() {
        return Array.from(list.querySelectorAll('li[data-value]'));
      }

      function visibleItems() {
        return allItems().filter(li => li.style.display !== 'none' && !li.classList.contains('ss-empty'));
      }

      function setHighlight(idx) {
        const vis = visibleItems();
        allItems().forEach(li => li.classList.remove('highlight'));
        highlightIdx = idx;
        if (idx >= 0 && idx < vis.length) {
          vis[idx].classList.add('highlight');
          vis[idx].scrollIntoView({ block: 'nearest' });
        }
      }

      function filterList(q) {
        q = (q || '').toLowerCase().trim();
        let any = false;
        allItems().forEach(li => {
          const lab = (li.dataset.label || '').toLowerCase();
          const show = !q || lab.indexOf(q) !== -1;
          li.style.display = show ? '' : 'none';
          if (show) any = true;
        });
        let emptyEl = list.querySelector('li.ss-empty');
        if (!any) {
          if (!emptyEl) {
            emptyEl = document.createElement('li');
            emptyEl.className = 'ss-empty';
            emptyEl.textContent = 'No matches';
            list.appendChild(emptyEl);
          }
          emptyEl.style.display = '';
        } else if (emptyEl) {
          emptyEl.style.display = 'none';
        }
        setHighlight(any ? 0 : -1);
      }

      function positionListFixed() {
        // Open straight down from the input; shift left only if needed (no horizontal page scroll)
        const rect = input.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const width = Math.min(Math.max(rect.width, 160), vw - 16);
        let left = rect.left;
        if (left + width > vw - 8) {
          left = Math.max(8, vw - 8 - width);
        }
        if (left < 8) left = 8;

        const spaceBelow = vh - rect.bottom - 12;
        const spaceAbove = rect.top - 12;
        const openUp = spaceBelow < 140 && spaceAbove > spaceBelow;
        const maxH = Math.min(280, Math.max(120, openUp ? spaceAbove : spaceBelow));

        list.classList.add('ss-list-fixed');
        list.style.position = 'fixed';
        list.style.right = 'auto';
        list.style.left = left + 'px';
        list.style.width = width + 'px';
        list.style.maxHeight = maxH + 'px';
        list.style.zIndex = '10050';
        list.style.display = 'block';
        list.style.overflowX = 'hidden';
        if (openUp) {
          list.style.top = 'auto';
          list.style.bottom = (vh - rect.top + 2) + 'px';
        } else {
          list.style.bottom = 'auto';
          list.style.top = (rect.bottom + 2) + 'px';
        }
      }

      function clearListFixed() {
        list.classList.remove('ss-list-fixed');
        list.style.position = '';
        list.style.left = '';
        list.style.top = '';
        list.style.bottom = '';
        list.style.width = '';
        list.style.maxHeight = '';
        list.style.zIndex = '';
        list.style.display = '';
      }

      function openList() {
        wrap.classList.add('open');
        const currentLabel = getLabelForValue(hidden.value);
        // If input still shows the selected label, show full list; else filter by typed text
        const q = (input.value === currentLabel) ? '' : input.value;
        filterList(q);
        positionListFixed();
      }

      function closeList() {
        wrap.classList.remove('open');
        clearListFixed();
        // Restore display label from current value
        input.value = getLabelForValue(hidden.value);
        highlightIdx = -1;
      }

      function getLabelForValue(val) {
        const li = allItems().find(x => x.dataset.value === String(val));
        return li ? li.dataset.label : (val === '' ? (allItems()[0] ? allItems()[0].dataset.label : '') : String(val));
      }

      function selectValue(val, label) {
        hidden.value = val == null ? '' : String(val);
        input.value = label != null ? label : getLabelForValue(hidden.value);
        closeList();
        if (onChangeName && typeof window[onChangeName] === 'function') {
          window[onChangeName](hidden.value);
        }
        // Fire change event for any listeners reading the hidden input
        hidden.dispatchEvent(new Event('change', { bubbles: true }));
      }

      input.addEventListener('focus', () => {
        openList();
        // Select all so typing replaces the current label
        setTimeout(() => input.select(), 0);
      });

      input.addEventListener('click', () => {
        openList();
      });

      input.addEventListener('input', () => {
        openList();
        filterList(input.value);
      });

      input.addEventListener('keydown', (e) => {
        const vis = visibleItems();
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          openList();
          setHighlight(Math.min(highlightIdx + 1, vis.length - 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setHighlight(Math.max(highlightIdx - 1, 0));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          const vis2 = visibleItems();
          if (highlightIdx >= 0 && highlightIdx < vis2.length) {
            const li = vis2[highlightIdx];
            selectValue(li.dataset.value, li.dataset.label);
          }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          closeList();
          input.blur();
        }
      });

      list.addEventListener('mousedown', (e) => {
        // Prevent input blur before click registers
        e.preventDefault();
      });

      list.addEventListener('click', (e) => {
        const li = e.target.closest('li[data-value]');
        if (!li || li.classList.contains('ss-empty')) return;
        selectValue(li.dataset.value, li.dataset.label);
      });

      // Keep fixed list aligned while scrolling / resizing
      window.addEventListener('scroll', () => {
        if (wrap.classList.contains('open')) positionListFixed();
      }, true);
      window.addEventListener('resize', () => {
        if (wrap.classList.contains('open')) positionListFixed();
      });
    }

    // Single document-level closer for all searchable selects
    if (!window._ssDocClickBound) {
      window._ssDocClickBound = true;
      document.addEventListener('click', function (ev) {
        document.querySelectorAll('.searchable-select.open').forEach(wrap => {
          const list = wrap.querySelector('.ss-list');
          // Clicks on fixed list still count as inside
          if (wrap.contains(ev.target) || (list && list.contains(ev.target))) return;
          wrap.classList.remove('open');
          if (list) {
            list.classList.remove('ss-list-fixed');
            list.style.left = list.style.top = list.style.width = list.style.maxHeight = list.style.zIndex = '';
          }
          const id = (wrap.id || '').replace(/^ss-wrap-/, '');
          const hidden = document.getElementById(id);
          const input = document.getElementById('ss-input-' + id);
          if (hidden && input && list) {
            const val = String(hidden.value);
            const li = Array.from(list.querySelectorAll('li[data-value]')).find(x => x.dataset.value === val);
            input.value = li ? li.dataset.label : (val || '');
          }
        });
      });
    }

    function initAllSearchableSelects() {
      // clearClass / clearSubject use dedicated comboboxes (initClearSubjectPicker)
      ['teacherSelect'].forEach(id => {
        const wrap = document.getElementById('ss-wrap-' + id);
        // Allow re-init when controls HTML is rebuilt (new DOM nodes)
        if (wrap) {
          delete wrap.dataset.ssInit;
          initSearchableSelect(id);
        }
      });
    }

    function rebuildDays() {
      const daysStr = document.getElementById('daysInput').value;
      state.days = daysStr.split(',').map(d => d.trim()).filter(Boolean);
      state.assignments = state.assignments.filter(a => state.days.includes(a.day));
      renderTable();
      updateConflicts();
      pushHistory();
    }

    function getSlotList(listKey) {
      if (listKey === 'examSlots') {
        if (!state.examSlots) state.examSlots = [];
        return state.examSlots;
      }
      return state.slots;
    }

    function renderSlots() {
      if (typeof fillJumatSlotSelect === 'function') fillJumatSlotSelect();
      const list = document.getElementById('slotList');
      if (!list) return;
      if (state.slots.length === 0) {
        list.innerHTML = '<p style="color:var(--muted);font-size:0.82rem;text-align:center;padding:8px;">No teaching periods yet</p>';
        return;
      }
      list.innerHTML = state.slots.map((s, idx) =>
        '<div class="list-item ' + (s.isBreak ? 'break-item' : '') + '">' +
        '<div style="flex:1;min-width:0;"><div class="name">' + (s.isBreak ? '☕ ' : '') + escapeHtml(s.label) + '</div>' +
        '<div class="meta">' + (s.start || '—') + ' – ' + (s.end || '—') + '</div></div>' +
        '<button class="icon-btn" onclick="moveSlot(' + idx + ', -1, \'slots\')" title="Move up"' + (idx === 0 ? ' disabled' : '') + '>⬆️</button>' +
        '<button class="icon-btn" onclick="moveSlot(' + idx + ', 1, \'slots\')" title="Move down"' + (idx === state.slots.length - 1 ? ' disabled' : '') + '>⬇️</button>' +
        '<button class="icon-btn" onclick="openSlotModal(\'' + s.id + '\', false, \'slots\')" title="Edit">✏️</button>' +
        '<button class="icon-btn" onclick="deleteSlot(\'' + s.id + '\', \'slots\')" title="Delete">🗑️</button></div>'
      ).join('');
    }

    function renderExamSlots() {
      const list = document.getElementById('examSlotList');
      if (!list) return;
      if (!state.examSlots) state.examSlots = [];
      if (state.examSlots.length === 0) {
        list.innerHTML = '<p style="color:var(--muted);font-size:0.82rem;text-align:center;padding:8px;">No exam sessions yet</p>';
      } else {
        list.innerHTML = state.examSlots.map((s, idx) =>
          '<div class="list-item ' + (s.isBreak ? 'break-item' : '') + '">' +
          '<div style="flex:1;min-width:0;"><div class="name">' + (s.isBreak ? '☕ ' : '📝 ') + escapeHtml(s.label) + '</div>' +
          '<div class="meta">' + (s.start || '—') + ' – ' + (s.end || '—') + '</div></div>' +
          '<button class="icon-btn" onclick="moveSlot(' + idx + ', -1, \'examSlots\')" title="Move up"' + (idx === 0 ? ' disabled' : '') + '>⬆️</button>' +
          '<button class="icon-btn" onclick="moveSlot(' + idx + ', 1, \'examSlots\')" title="Move down"' + (idx === state.examSlots.length - 1 ? ' disabled' : '') + '>⬇️</button>' +
          '<button class="icon-btn" onclick="openSlotModal(\'' + s.id + '\', false, \'examSlots\')" title="Edit">✏️</button>' +
          '<button class="icon-btn" onclick="deleteSlot(\'' + s.id + '\', \'examSlots\')" title="Delete">🗑️</button></div>'
        ).join('');
      }
      renderExamDaysEditor();
    }

    function getExamDayOptions() {
      const base = (state.days && state.days.length) ? state.days.slice() : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
      ['Sat', 'Sun'].forEach(d => { if (!base.includes(d)) base.push(d); });
      return base;
    }

    function newExamScheduleId() {
      return 'ed' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    }

    function ensureExamSchedule() {
      if (!Array.isArray(state.examSchedule)) state.examSchedule = [];
      state.examSchedule.forEach(r => {
        if (!r || !r.day) return;
        if (!r.id) {
          const sameDay = state.examSchedule.filter(x => x && x.day === r.day);
          if (sameDay.length <= 1) r.id = r.day;
          else r.id = newExamScheduleId();
        }
      });
      if (!state.examSchedule.length && state.days && state.days.length) {
        state.examSchedule = state.days.map(d => ({ id: d, day: d, date: '' }));
      }
    }

    function getExamSchedule() {
      ensureExamSchedule();
      return state.examSchedule.filter(r => r && r.day);
    }

    function examDayKey(row) {
      if (!row) return '';
      return row.id || row.day;
    }

    function formatExamDate(iso) {
      if (!iso) return '';
      const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) return iso;
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const mon = months[parseInt(m[2], 10) - 1] || m[2];
      return parseInt(m[3], 10) + ' ' + mon + ' ' + m[1];
    }

    function addDaysToIso(iso, days) {
      if (!iso) return '';
      const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) return '';
      const dt = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
      if (isNaN(dt.getTime())) return '';
      dt.setUTCDate(dt.getUTCDate() + days);
      const y = dt.getUTCFullYear();
      const mo = String(dt.getUTCMonth() + 1).padStart(2, '0');
      const d = String(dt.getUTCDate()).padStart(2, '0');
      return y + '-' + mo + '-' + d;
    }

    function renderExamDaysEditor() {
      const box = document.getElementById('examDaysEditor');
      if (!box) return;
      ensureExamSchedule();
      const options = getExamDayOptions();
      if (!state.examSchedule.length) {
        box.innerHTML = '<p style="font-size:0.78rem;color:#64748b;margin:0;">No exam days yet — use <strong>+ Add day</strong> or <strong>Fill week days</strong>.</p>';
        return;
      }
      box.innerHTML = state.examSchedule.map((row, idx) => {
        const id = examDayKey(row);
        const dayOpts = options.map(d =>
          '<option value="' + escapeHtml(d) + '"' + (d === row.day ? ' selected' : '') + '>' + escapeHtml(d) + '</option>'
        ).join('');
        return (
          '<div class="exam-day-row" data-id="' + escapeHtml(id) + '" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:6px 8px;background:#fff;border:1px solid var(--border);border-radius:8px;">' +
          '<span class="subj-num" title="Row ' + (idx + 1) + '">' + (idx + 1) + '</span>' +
          '<select onchange="setExamDayName(\'' + escapeHtml(id) + '\', this.value)" style="width:88px;padding:5px 6px;border-radius:6px;border:1px solid var(--border);font-size:0.8rem;">' +
          dayOpts + '</select>' +
          '<input type="date" value="' + escapeHtml(row.date || '') + '" ' +
          'onchange="setExamDayDateById(\'' + escapeHtml(id) + '\', this.value)" ' +
          'style="flex:1;min-width:130px;padding:5px 8px;border:1px solid var(--border);border-radius:6px;font-size:0.8rem;" />' +
          '<button type="button" class="btn btn-danger btn-xs" onclick="removeExamDayRow(\'' + escapeHtml(id) + '\')" title="Remove this day">✕</button>' +
          '</div>'
        );
      }).join('');
    }

    function addExamDayRow() {
      ensureExamSchedule();
      const options = getExamDayOptions();
      const day = options[state.examSchedule.length % options.length] || 'Mon';
      state.examSchedule.push({ id: newExamScheduleId(), day: day, date: '' });
      renderExamDaysEditor();
      if (state.currentView === 'exam') renderTable();
      if (typeof pushHistory === 'function') pushHistory();
    }

    function addExamWeekRows() {
      ensureExamSchedule();
      const options = getExamDayOptions();
      const weekDays = (state.days && state.days.length) ? state.days.slice() : options.filter(d => d !== 'Sat' && d !== 'Sun');
      if (!state.examSchedule.length) {
        state.examSchedule = weekDays.map(d => ({ id: newExamScheduleId(), day: d, date: '' }));
        renderExamDaysEditor();
        if (state.currentView === 'exam') renderTable();
        if (typeof pushHistory === 'function') pushHistory();
        showToast('Added week days — set the first dates, then + Add next week');
        return;
      }
      const n = weekDays.length;
      const template = [];
      const tail = state.examSchedule.slice(-n);
      if (tail.length === n && tail.every((r, i) => r.day === weekDays[i])) {
        tail.forEach(r => template.push(r));
      } else {
        weekDays.forEach(d => {
          for (let i = state.examSchedule.length - 1; i >= 0; i--) {
            if (state.examSchedule[i].day === d) {
              template.push(state.examSchedule[i]);
              break;
            }
          }
        });
        if (!template.length) {
          weekDays.forEach(d => template.push({ day: d, date: '' }));
        }
      }
      template.forEach(r => {
        state.examSchedule.push({
          id: newExamScheduleId(),
          day: r.day,
          date: r.date ? addDaysToIso(r.date, 7) : ''
        });
      });
      renderExamDaysEditor();
      if (state.currentView === 'exam') renderTable();
      if (typeof pushHistory === 'function') pushHistory();
      showToast('Added next week (' + template.length + ' day(s))');
    }

    function removeExamDayRow(id) {
      ensureExamSchedule();
      const key = String(id);
      state.examSchedule = state.examSchedule.filter(r => examDayKey(r) !== key);
      if (state.exams && state.exams.length) {
        state.exams = state.exams.filter(e => e.day !== key);
      }
      renderExamDaysEditor();
      if (state.currentView === 'exam') renderTable();
      if (typeof pushHistory === 'function') pushHistory();
    }

    function setExamDayName(id, dayName) {
      ensureExamSchedule();
      const row = state.examSchedule.find(r => examDayKey(r) === id);
      if (!row) return;
      row.day = dayName;
      renderExamDaysEditor();
      if (state.currentView === 'exam') renderTable();
      if (typeof pushHistory === 'function') pushHistory();
    }

    function setExamDayDateById(id, dateVal) {
      ensureExamSchedule();
      const row = state.examSchedule.find(r => examDayKey(r) === id);
      if (!row) return;
      row.date = dateVal || '';
      if (state.currentView === 'exam') renderTable();
      if (typeof pushHistory === 'function') pushHistory();
    }

    function toggleExamDay(day, checked) {
      ensureExamSchedule();
      if (checked) {
        if (!state.examSchedule.some(r => r.day === day)) {
          state.examSchedule.push({ id: newExamScheduleId(), day: day, date: '' });
        }
      } else {
        state.examSchedule = state.examSchedule.filter(r => r.day !== day);
      }
      renderExamDaysEditor();
      if (state.currentView === 'exam') renderTable();
    }

    function setExamDayDate(day, dateVal) {
      ensureExamSchedule();
      const row = state.examSchedule.find(r => r.day === day);
      if (row) row.date = dateVal || '';
      else state.examSchedule.push({ id: newExamScheduleId(), day: day, date: dateVal || '' });
      if (state.currentView === 'exam') renderTable();
    }

    function selectAllExamDays() {
      ensureExamSchedule();
      const week = (state.days && state.days.length) ? state.days.slice() : getExamDayOptions().filter(d => d !== 'Sat' && d !== 'Sun');
      if (!state.examSchedule.length) {
        state.examSchedule = week.map(d => ({ id: d, day: d, date: '' }));
      } else {
        week.forEach(d => {
          if (!state.examSchedule.some(r => r.day === d)) {
            state.examSchedule.push({ id: newExamScheduleId(), day: d, date: '' });
          }
        });
      }
      renderExamDaysEditor();
      if (state.currentView === 'exam') renderTable();
      if (typeof pushHistory === 'function') pushHistory();
      showToast('Week days ready — set dates, use + Add next week for more weeks');
    }

    function clearExamDays() {
      if (state.examSchedule && state.examSchedule.length &&
          !confirm('Clear all Exam/CA days and dates? Exam sessions on those days will also be removed.')) return;
      const daysCleared = (state.examSchedule || []).map(r => examDayKey(r));
      state.examSchedule = [];
      if (state.exams && state.exams.length && daysCleared.length) {
        state.exams = state.exams.filter(e => daysCleared.indexOf(e.day) < 0);
      }
      renderExamDaysEditor();
      if (state.currentView === 'exam') renderTable();
      if (typeof pushHistory === 'function') pushHistory();
      showToast('Exam days cleared');
    }


    function openSlotModal(id, forceBreak, listKey) {
      state.editingSlotList = listKey || 'slots';
      state.editingSlotId = id;
      const arr = getSlotList(state.editingSlotList);
      const isExam = state.editingSlotList === 'examSlots';
      const title = document.getElementById('slotModalTitle');
      if (id) {
        const s = arr.find(x => x.id === id);
        if (!s) return;
        title.textContent = (isExam ? 'Exam/CA · ' : '') + (s.isBreak ? 'Edit Break' : 'Edit Period');
        document.getElementById('slotLabel').value = s.label;
        document.getElementById('slotStart').value = s.start || '';
        document.getElementById('slotEnd').value = s.end || '';
        document.getElementById('slotIsBreak').checked = s.isBreak;
      } else {
        title.textContent = (isExam ? 'Exam/CA · ' : '') + (forceBreak ? 'Add Break' : (isExam ? 'Add Session' : 'Add Period'));
        const n = arr.filter(x => !x.isBreak).length + 1;
        document.getElementById('slotLabel').value = forceBreak ? 'Break' : (isExam ? ('Paper ' + n) : ('Period ' + n));
        document.getElementById('slotStart').value = '';
        document.getElementById('slotEnd').value = '';
        document.getElementById('slotIsBreak').checked = !!forceBreak;
      }
      document.getElementById('slotModal').classList.add('open');
      document.getElementById('slotLabel').focus();
    }

    function closeSlotModal() {
      document.getElementById('slotModal').classList.remove('open');
      state.editingSlotId = null;
      state.editingSlotList = 'slots';
    }

    function saveSlot() {
      const label = document.getElementById('slotLabel').value.trim();
      if (!label) { showToast('Label is required'); return; }
      const start = document.getElementById('slotStart').value;
      const end = document.getElementById('slotEnd').value;
      const isBreak = document.getElementById('slotIsBreak').checked;
      const listKey = state.editingSlotList || 'slots';
      const arr = getSlotList(listKey);
      const isExam = listKey === 'examSlots';

      if (state.editingSlotId) {
        const s = arr.find(x => x.id === state.editingSlotId);
        if (!s) return;
        const wasBreak = s.isBreak;
        s.label = label; s.start = start; s.end = end; s.isBreak = isBreak;
        if (isBreak && !wasBreak) {
          if (isExam) state.exams = (state.exams || []).filter(a => a.slotId !== s.id);
          else state.assignments = state.assignments.filter(a => a.slotId !== s.id);
        }
        showToast(isExam ? 'Exam session updated' : 'Updated');
      pushHistory();
      } else {
        const prefix = isExam ? (isBreak ? 'eb' : 'ep') : (isBreak ? 'b' : 'p');
        arr.push({
          id: prefix + Date.now(),
          label, start, end, isBreak
        });
        showToast(isBreak ? 'Break added' : (isExam ? 'Exam session added' : 'Period added'));
        pushHistory();
      }
      closeSlotModal();
      renderSlots();
      renderExamSlots();
      renderTable();
      if (isExam) updateExamConflicts();
      else updateConflicts();
      updateMeta();
    }

    function deleteSlot(id, listKey) {
      listKey = listKey || 'slots';
      const arr = getSlotList(listKey);
      const s = arr.find(x => x.id === id);
      if (!s) return;
      if (!confirm('Delete "' + s.label + '"?')) return;
      if (listKey === 'examSlots') {
        state.examSlots = state.examSlots.filter(x => x.id !== id);
        state.exams = (state.exams || []).filter(a => a.slotId !== id);
        renderExamSlots();
        updateExamConflicts();
      } else {
        state.slots = state.slots.filter(x => x.id !== id);
        state.assignments = state.assignments.filter(a => a.slotId !== id);
        renderSlots();
        updateConflicts();
      }
      renderTable();
      updateMeta();
      showToast('Deleted');
      pushHistory()
    }

    function moveSlot(index, dir, listKey) {
      listKey = listKey || 'slots';
      const arr = getSlotList(listKey);
      const newIndex = index + dir;
      if (newIndex < 0 || newIndex >= arr.length) return;
      const tmp = arr[index];
      arr[index] = arr[newIndex];
      arr[newIndex] = tmp;
      if (listKey === 'examSlots') renderExamSlots();
      else renderSlots();
      renderTable();
    }

    function renderClasses() {
      const list = document.getElementById('classList');
      if (state.classes.length === 0) {
        list.innerHTML = '<p style="color:var(--muted);font-size:0.82rem;text-align:center;padding:8px;">No classes yet</p>';
        return;
      }
      list.innerHTML = state.classes.map(c =>
        '<div class="list-item"><div class="name">' + escapeHtml(c.name) + '</div>' +
        '<button class="icon-btn" onclick="editClass(\'' + c.id + '\')" title="Edit">✏️</button>' +
        '<button class="icon-btn" onclick="duplicateClass(\'' + c.id + '\')" title="Duplicate class">📄</button>' +
        '<button class="icon-btn" onclick="deleteClass(\'' + c.id + '\')" title="Delete">🗑️</button></div>'
      ).join('');
    }

    function openClassModal(id) {
      state.editingClassId = id || null;
      document.getElementById('classModalTitle').textContent = id ? 'Edit Class' : 'Add Class';
      document.getElementById('classNameInput').value = id ? state.classes.find(x => x.id === id).name : '';
      document.getElementById('classModal').classList.add('open');
      document.getElementById('classNameInput').focus();
    }

    function closeClassModal() {
      document.getElementById('classModal').classList.remove('open');
      state.editingClassId = null;
    }

    function saveClass() {
      const name = document.getElementById('classNameInput').value.trim();
      if (!name) { showToast('Class name required'); return; }
      if (state.editingClassId) {
        state.classes.find(x => x.id === state.editingClassId).name = name;
        showToast('Class updated');
      pushHistory();
      } else {
        const newId = 'c' + Date.now();
        state.classes.push({ id: newId, name });
        // Default weekly frequency for new class on existing subjects
        state.subjects.forEach(s => {
          if (!s.weeklyByClass) s.weeklyByClass = getWeeklyMap(s);
          if (s.weeklyByClass[newId] == null) s.weeklyByClass[newId] = 0;
        });
        showToast('Class added');
      pushHistory();
      }
      closeClassModal();
      renderClasses();
      updateMeta();
      if (state.currentView === 'class') switchView('class');
      renderTable();
      renderSubjects();
    }

    function editClass(id) { openClassModal(id); }

    /** Unique class name based on a base (adds " (copy)", " (copy 2)", …). */
    function uniqueClassName(base) {
      const names = new Set((state.classes || []).map(c => (c.name || '').toLowerCase().trim()));
      let name = (base || 'Class').trim() || 'Class';
      if (!names.has(name.toLowerCase())) return name;
      let n = 1;
      while (names.has((name + ' (copy' + (n === 1 ? '' : ' ' + n) + ')').toLowerCase())) n++;
      return name + ' (copy' + (n === 1 ? '' : ' ' + n) + ')';
    }

    /**
     * Duplicate a class arm: same weekly subject loads.
     * Optionally copy placed periods from the source class.
     */
    function duplicateClass(id) {
      const src = state.classes.find(x => x.id === id);
      if (!src) { showToast('Class not found'); return; }
      const newName = uniqueClassName(src.name);
      const copyTimetable = confirm(
        'Duplicate class "' + src.name + '" as "' + newName + '"?\n\n' +
        'OK = Also copy its placed periods to the new class\n' +
        'Cancel = Only copy the class + weekly subject loads (empty timetable)'
      );
      // Note: Cancel still duplicates class without periods — use a second pattern via confirm is awkward.
      // Better: always create class; ask explicitly about periods.
      const newId = 'c' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      state.classes.push({ id: newId, name: newName });

      // Copy weekly loads from source class onto the new class for every subject
      (state.subjects || []).forEach(s => {
        if (!s.weeklyByClass) s.weeklyByClass = getWeeklyMap(s);
        const srcLoad = s.weeklyByClass[id];
        if (srcLoad != null) s.weeklyByClass[newId] = srcLoad;
        else if (s.weeklyByClass[newId] == null) s.weeklyByClass[newId] = 0;
      });

      let copiedPeriods = 0;
      if (copyTimetable) {
        const clones = (state.assignments || [])
          .filter(a => a.classId === id)
          .map(a => {
            copiedPeriods++;
            return {
              id: 'a' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '_' + copiedPeriods,
              day: a.day,
              slotId: a.slotId,
              classId: newId,
              subjectId: a.subjectId,
              grouped: a.grouped,
              groupName: a.groupName,
              autoGenerated: !!a.autoGenerated,
              locked: false
            };
          });
        state.assignments = (state.assignments || []).concat(clones);
      }

      renderClasses();
      renderSubjects();
      updateMeta();
      updateConflicts();
      renderTable();
      if (state.currentView === 'class') switchView('class');
      showToast(
        'Duplicated "' + src.name + '" → "' + newName + '"' +
        (copiedPeriods ? (' · ' + copiedPeriods + ' period(s) copied') : ' · empty timetable')
      );
      pushHistory();
      // Offer rename immediately
      openClassModal(newId);
    }

    function deleteClass(id) {
      const c = state.classes.find(x => x.id === id);
      if (!confirm('Delete "' + c.name + '" and all its assignments?')) return;
      state.classes = state.classes.filter(x => x.id !== id);
      state.assignments = state.assignments.filter(a => a.classId !== id);
      if (state.selectedClassId === id) state.selectedClassId = null;
      renderClasses();
      const tgl = document.getElementById('usePerDayTimesToggle'); if (tgl) tgl.checked = !!state.usePerDayTimes;
      renderTable();
      renderSubjects();
      updateConflicts();
      updateMeta();
      if (state.currentView === 'class') switchView('class');
      showToast('Class deleted');
      pushHistory();
    }

    function renderSubjects() {
      const list = document.getElementById('subjectList');
      if (state.subjects.length === 0) {
        list.innerHTML = '<p style="color:var(--muted);font-size:0.82rem;text-align:center;padding:8px;">No subjects yet</p>';
        renderSubjectLoad();
        return;
      }
      list.innerHTML = state.subjects.map((s, idx) => {
        const num = idx + 1;
        const wmap = getWeeklyMap(s);
        const assigned = state.assignments.filter(a => a.subjectId === s.id).length;
        const target = state.classes.reduce((sum, c) => sum + (wmap[c.id] || 0), 0);
        const meta = escapeHtml(s.teacher || '') + (s.room ? ' · ' + escapeHtml(s.room) : '');
        // Class chips: Class + placed/need (e.g. SS1A 1/2)
        const chips = state.classes
          .map(c => {
            const need = wmap[c.id] || 0;
            if (need <= 0) return null;
            const cnt = state.assignments.filter(a => a.subjectId === s.id && a.classId === c.id).length;
            const cColor = cnt >= need ? '#16a34a' : (cnt > 0 ? '#ca8a04' : '#64748b');
            const bg = cnt >= need ? '#dcfce7' : (cnt > 0 ? '#fef9c3' : '#f1f5f9');
            const left = Math.max(0, need - cnt);
            return '<span class="subj-chip" style="color:' + cColor + ';background:' + bg + ';" title="' +
              escapeHtml(c.name) + ': ' + cnt + ' of ' + need + ' placed' +
              (left ? ' (' + left + ' left)' : ' (complete)') + '">' +
              '<span class="subj-chip-class">' + escapeHtml(c.name) + '</span> ' +
              '<span class="subj-chip-frac">' + cnt + '/' + need + '</span></span>';
          })
          .filter(Boolean)
          .join('');
        const ok = assigned >= target && target > 0 ? '#16a34a' : (assigned > 0 ? '#ca8a04' : '#94a3b8');
        const remain = Math.max(0, target - assigned);
        const totalLine = target > 0
          ? '<div class="subj-total" style="color:' + ok + ';">' + assigned + '/' + target +
            (remain ? ' · ' + remain + ' left' : ' · done') + '</div>'
          : '';
        return '<div class="list-item">' +
          '<span class="subj-num" title="Subject #' + num + '">' + num + '</span>' +
          '<div class="color-dot" style="background:' + s.color + '"></div>' +
          '<div class="subj-main">' +
            '<div class="name">' + escapeHtml(s.name) + '</div>' +
            '<div class="meta">' + meta + '</div>' +
            (chips ? '<div class="subj-classes">' + chips + '</div>' : '') +
            totalLine +
          '</div>' +
          '<button class="icon-btn" onclick="editSubject(\'' + s.id + '\')" title="Edit">✏️</button>' +
          '<button class="icon-btn" onclick="duplicateSubject(\'' + s.id + '\')" title="Duplicate subject">📄</button>' +
          '<button class="icon-btn" onclick="deleteSubject(\'' + s.id + '\')" title="Delete">🗑️</button></div>';
      }).join('');
      renderSubjectLoad();
    }

    
    function migrateWeekly(s) {
      // Old global weeklyPeriods -> apply to all current classes
      const map = {};
      const n = s.weeklyPeriods || 0;
      if (n) state.classes.forEach(c => { map[c.id] = n; });
      return map;
    }

    function getWeeklyMap(s) {
      if (s.weeklyByClass && typeof s.weeklyByClass === 'object') return s.weeklyByClass;
      return migrateWeekly(s);
    }

    function getWeeklyFor(subjectId, classId) {
      const s = state.subjects.find(x => x.id === subjectId);
      if (!s) return 0;
      const map = getWeeklyMap(s);
      return map[classId] || 0;
    }

    function normalizeSubjectName(name) {
      return String(name || '').toLowerCase().replace(/\s+/g, ' ').trim();
    }

    function normalizeTeacherName(name) {
      return String(name || '').toLowerCase().replace(/\s+/g, ' ').trim();
    }

    /**
     * Same subject name taught by a different teacher already linked to this class
     * (via weekly load or existing assignments). One teacher per subject per class.
     */
    function findOtherTeacherForSubjectInClass(subjectName, teacherName, classId, excludeSubjectId) {
      const nameKey = normalizeSubjectName(subjectName);
      const teacherKey = normalizeTeacherName(teacherName);
      if (!nameKey || !classId) return null;

      for (const s of state.subjects) {
        if (excludeSubjectId && s.id === excludeSubjectId) continue;
        if (normalizeSubjectName(s.name) !== nameKey) continue;
        if (normalizeTeacherName(s.teacher) === teacherKey) continue; // same teacher = ok (same entry)

        // Other teacher already has weekly load for this class?
        const need = getWeeklyFor(s.id, classId);
        if (need > 0) {
          return { subject: s, via: 'weekly', classId };
        }
        // Other teacher already assigned in the timetable for this class?
        const assigned = state.assignments.some(a => a.subjectId === s.id && a.classId === classId);
        if (assigned) {
          return { subject: s, via: 'assignment', classId };
        }
      }
      return null;
    }

    /** Classes where this subject name + teacher would clash with another teacher. */
    function findTeacherSubjectClassConflicts(subjectName, teacherName, weeklyByClass, excludeSubjectId) {
      const conflicts = [];
      const map = weeklyByClass || {};
      Object.keys(map).forEach(classId => {
        const n = parseInt(map[classId], 10) || 0;
        if (n <= 0) return;
        const hit = findOtherTeacherForSubjectInClass(subjectName, teacherName, classId, excludeSubjectId);
        if (hit) {
          const cls = state.classes.find(c => c.id === classId);
          conflicts.push({
            classId,
            className: cls ? cls.name : classId,
            otherTeacher: hit.subject.teacher || '?',
            otherSubjectId: hit.subject.id,
            via: hit.via
          });
        }
      });
      return conflicts;
    }

    function formatTeacherSubjectConflict(conflict, subjectName) {
      return '🚫 <strong>' + escapeHtml(subjectName) + '</strong> for <strong>' + escapeHtml(conflict.className) +
        '</strong> is already taught by <strong>' + escapeHtml(conflict.otherTeacher) +
        '</strong>. Only one teacher may teach the same subject in a class.';
    }

    function renderWeeklyByClassInputs(existing) {
      const box = document.getElementById('subjWeeklyByClass');
      const hint = document.getElementById('subjWeeklyHint');
      if (!box) return;
      if (state.classes.length === 0) {
        box.innerHTML = '';
        if (hint) hint.style.display = 'block';
        return;
      }
      if (hint) hint.style.display = 'none';
      const map = existing || {};
      box.innerHTML = state.classes.map(c => {
        const val = map[c.id] != null ? map[c.id] : 0;
        return '<div style="display:flex;align-items:center;gap:4px;">' +
          '<label style="min-width:0;font-size:0.85rem;font-weight:600;margin:0;white-space:nowrap;">' + escapeHtml(c.name) + '</label>' +
          '<input type="number" min="0" max="20" value="' + val + '" data-class-id="' + c.id + '" ' +
          'style="width:52px;padding:4px 6px;margin:0;" class="weekly-class-input" />' +
          '<span style="font-size:0.72rem;color:#64748b;white-space:nowrap;">×/wk</span></div>';
      }).join('');
    }

    function collectWeeklyByClassInputs() {
      const map = {};
      document.querySelectorAll('.weekly-class-input').forEach(inp => {
        let n = parseInt(inp.value, 10);
        if (isNaN(n) || n < 0) n = 0;
        if (n > 20) n = 20;
        map[inp.dataset.classId] = n;
      });
      return map;
    }

    function renderSubjectLoad() {
      const list = document.getElementById('subjectLoadList');
      if (!list) return;
      if (state.subjects.length === 0) {
        list.innerHTML = '<p style="color:var(--muted);font-size:0.82rem;text-align:center;padding:8px;">No subjects</p>';
        return;
      }
      list.innerHTML = state.subjects.map((s, idx) => {
        const num = idx + 1;
        const wmap = getWeeklyMap(s);
        const assigned = state.assignments.filter(a => a.subjectId === s.id).length;
        const target = state.classes.reduce((sum, c) => sum + (wmap[c.id] || 0), 0);
        let color = '#94a3b8';
        if (target > 0) {
          if (assigned >= target) color = '#16a34a';
          else if (assigned > 0) color = '#ca8a04';
        }
        let perClass = '';
        if (state.classes.length) {
          const rows = state.classes.map(c => {
            const need = wmap[c.id] || 0;
            const cnt = state.assignments.filter(a => a.subjectId === s.id && a.classId === c.id).length;
            const cColor = need === 0 ? '#94a3b8' : (cnt >= need ? '#16a34a' : (cnt > 0 ? '#ca8a04' : '#94a3b8'));
            return '<span style="color:' + cColor + ';">' + escapeHtml(c.name) + ': ' + cnt + '/' + need + '</span>';
          }).join(' · ');
          perClass = '<div class="meta" style="margin-top:2px;">' + rows + '</div>';
        }
        return '<div class="list-item" style="flex-direction:column;align-items:stretch;gap:4px;">' +
          '<div style="display:flex;align-items:center;gap:8px;">' +
          '<span class="subj-num" title="Subject #' + num + '">' + num + '</span>' +
          '<div class="color-dot" style="background:' + s.color + '"></div>' +
          '<div class="name" style="flex:1;">' + escapeHtml(s.name) + '</div>' +
          '<span style="font-size:0.78rem;font-weight:700;color:' + color + ';">' + assigned + '/' + (target || '—') + '</span>' +
          '</div>' + perClass + '</div>';
      }).join('');
    }

    function openSubjectModal(id) {
      state.editingSubjectId = id || null;
      document.getElementById('subjectModalTitle').textContent = id ? 'Edit Subject' : 'Add Subject';
      if (id) {
        const s = state.subjects.find(x => x.id === id);
        document.getElementById('subjName').value = s.name;
        document.getElementById('subjTeacher').value = s.teacher || '';
        document.getElementById('subjRoom').value = s.room || '';
        selectColor(s.color);
        renderWeeklyByClassInputs(s.weeklyByClass || migrateWeekly(s));
      } else {
        document.getElementById('subjName').value = '';
        document.getElementById('subjTeacher').value = '';
        document.getElementById('subjRoom').value = '';
        selectColor(COLORS[state.subjects.length % COLORS.length]);
        renderWeeklyByClassInputs({});
      }
      document.getElementById('subjectModal').classList.add('open');
      document.getElementById('subjName').focus();
    }

    function closeSubjectModal() {
      document.getElementById('subjectModal').classList.remove('open');
      state.editingSubjectId = null;
    }

    function saveSubject() {
      const name = document.getElementById('subjName').value.trim();
      const teacher = document.getElementById('subjTeacher').value.trim();
      if (!name) { showToast('Subject name required'); return; }
      if (!teacher) { showToast('Teacher name is required for clash detection'); return; }
      const room = document.getElementById('subjRoom').value.trim();
      const color = document.querySelector('.color-swatch.selected')?.dataset.color || COLORS[0];
      const weeklyByClass = collectWeeklyByClassInputs();

      // One teacher per subject name per class
      const conflicts = findTeacherSubjectClassConflicts(
        name, teacher, weeklyByClass, state.editingSubjectId || null
      );
      if (conflicts.length) {
        const msg = conflicts.map(c =>
          name + ' for ' + c.className + ' is already taught by ' + c.otherTeacher
        ).join('\n');
        showToast('Cannot save: same subject cannot have two teachers in one class');
        alert('Only one teacher may teach the same subject in a class.\n\n' + msg);
        return;
      }

      // Also block if weekly is 0 but assignments already exist under another teacher with same name
      // (handled when assigning). When editing name/teacher, strip invalid existing assignments?
      if (state.editingSubjectId) {
        const s = state.subjects.find(x => x.id === state.editingSubjectId);
        s.name = name; s.teacher = teacher; s.room = room; s.color = color;
        s.weeklyByClass = weeklyByClass;
        delete s.weeklyPeriods;
      } else {
        state.subjects.push({ id: 's' + Date.now(), name, teacher, room, color, weeklyByClass });
      }
      closeSubjectModal();
      renderSubjects();
      renderSubjectLoad();
      renderTable();
      updateConflicts();
      updateMeta();
      if (state.currentView === 'teacher') switchView('teacher');
      showToast('Subject saved');
      pushHistory();
    }

    function editSubject(id) { openSubjectModal(id); }

    function uniqueSubjectLabel(name, teacher) {
      const base = (name || 'Subject').trim() || 'Subject';
      const t = (teacher || '').trim();
      const exists = function (n) {
        return (state.subjects || []).some(s =>
          normalizeSubjectName(s.name) === normalizeSubjectName(n) &&
          normalizeTeacherName(s.teacher) === normalizeTeacherName(t)
        );
      };
      if (!exists(base)) return base;
      let n = 1;
      let candidate;
      do {
        candidate = base + ' (copy' + (n === 1 ? '' : ' ' + n) + ')';
        n++;
      } while (exists(candidate));
      return candidate;
    }

    /**
     * Duplicate subject: same teacher, room, color, weekly loads; new id.
     * Does not copy placed periods (avoids instant double-booking).
     */
    function duplicateSubject(id) {
      const src = state.subjects.find(x => x.id === id);
      if (!src) { showToast('Subject not found'); return; }
      const newName = uniqueSubjectLabel(src.name, src.teacher);
      const weeklyByClass = {};
      const map = getWeeklyMap(src);
      Object.keys(map).forEach(cid => {
        weeklyByClass[cid] = map[cid];
      });
      // Pick a nearby color if possible
      let color = src.color || COLORS[0];
      const used = new Set((state.subjects || []).map(s => s.color));
      const free = COLORS.find(c => !used.has(c));
      if (free) color = free;

      const newId = 's' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      state.subjects.push({
        id: newId,
        name: newName,
        teacher: src.teacher || '',
        room: src.room || '',
        color: color,
        weeklyByClass: weeklyByClass
      });

      renderSubjects();
      renderSubjectLoad();
      updateMeta();
      if (state.currentView === 'teacher') switchView('teacher');
      showToast('Duplicated subject → "' + newName + '" · edit teacher/loads if needed');
      pushHistory();
      openSubjectModal(newId);
    }

    function deleteSubject(id) {
      if (!confirm('Delete this subject and remove it from all slots?')) return;
      state.subjects = state.subjects.filter(s => s.id !== id);
      state.assignments = state.assignments.filter(a => a.subjectId !== id);
      renderSubjects();
      renderTable();
      updateConflicts();
      updateMeta();
      if (state.currentView === 'teacher') switchView('teacher');
      showToast('Subject deleted');
      pushHistory();
    }

    function renderColorPicker() {
      document.getElementById('colorPicker').innerHTML = COLORS.map(c =>
        '<div class="color-swatch" style="background:' + c + '" data-color="' + c + '" onclick="selectColor(\'' + c + '\')"></div>'
      ).join('');
    }

    function selectColor(color) {
      document.querySelectorAll('.color-swatch').forEach(el => {
        el.classList.toggle('selected', el.dataset.color === color);
      });
    }

    function getAssignmentsForSlot(day, slotId) {
      // Prefer pre-built index during a full grid render (school view)
      if (window._assignIndex) {
        const key = day + '|' + slotId;
        return window._assignIndex[key] || [];
      }
      return state.assignments.filter(a => a.day === day && a.slotId === slotId);
    }

    /** Build day|slotId and day|slotId|classId → assignments[] for fast grid rendering. */
    function buildAssignmentIndex() {
      const idx = {};
      (state.assignments || []).forEach(a => {
        const key = a.day + '|' + a.slotId;
        if (!idx[key]) idx[key] = [];
        idx[key].push(a);
        if (a.classId) {
          const ck = key + '|' + a.classId;
          if (!idx[ck]) idx[ck] = [];
          idx[ck].push(a);
        }
      });
      return idx;
    }

    function getAssignmentsForSlotClass(day, slotId, classId) {
      if (window._assignIndex && classId) {
        return window._assignIndex[day + '|' + slotId + '|' + classId] || [];
      }
      return getAssignmentsForSlot(day, slotId).filter(e => e.classId === classId);
    }

    /** Map assignmentId → true for O(1) clash checks. */
    function buildClashIdSet(clashes) {
      const set = {};
      if (!clashes) return set;
      Object.keys(clashes).forEach(key => {
        const arr = clashes[key];
        if (!arr) return;
        for (let i = 0; i < arr.length; i++) {
          if (arr[i] && arr[i].id) set[arr[i].id] = true;
        }
      });
      return set;
    }

    function subjectById(id) {
      if (!window._subjectMap) {
        window._subjectMap = {};
        (state.subjects || []).forEach(s => { window._subjectMap[s.id] = s; });
      }
      return window._subjectMap[id];
    }

    function classById(id) {
      if (!window._classMap) {
        window._classMap = {};
        (state.classes || []).forEach(c => { window._classMap[c.id] = c; });
      }
      return window._classMap[id];
    }

    function invalidateLookupCaches() {
      window._subjectMap = null;
      window._classMap = null;
      window._assignIndex = null;
      window._clashIdSet = null;
    }

    /**
     * Class arm base: "SS 1A", "SS1B", "JSS 2-C" → "ss 1" / "ss1" / "jss 2"
     * Arms of the same class can share one teacher+subject in the same period (combined).
     */
    function getClassArmBase(name) {
      const n = String(name || '').replace(/\s+/g, ' ').trim();
      if (!n) return '';
      // Trailing arm letter after a digit: SS 1A, SS1A, Form 3-B, Basic 5 C
      const m = n.match(/^(.+\d)[\s\-]*([A-Za-z])$/);
      if (m) return m[1].replace(/\s+/g, ' ').trim().toLowerCase();
      return n.toLowerCase();
    }

    function classesAreSameArmGroup(classIdA, classIdB) {
      if (!classIdA || !classIdB) return false;
      if (classIdA === classIdB) return true;
      const a = state.classes.find(c => c.id === classIdA);
      const b = state.classes.find(c => c.id === classIdB);
      if (!a || !b) return false;
      const ba = getClassArmBase(a.name);
      const bb = getClassArmBase(b.name);
      return ba && bb && ba === bb;
    }

    /** Combined lesson: same teacher, same subject name, arms of the same class. */
    function isCombinedArmAssignment(assignment, subjectObj, otherClassId, otherSubjectObj) {
      if (!assignment || !subjectObj || !otherSubjectObj) return false;
      if (normalizeSubjectName(subjectObj.name) !== normalizeSubjectName(otherSubjectObj.name)) return false;
      return classesAreSameArmGroup(assignment.classId, otherClassId);
    }

    /**
     * True if teacher is busy in day+slot with a lesson that cannot combine with
     * the given class+subject (different class group or different subject).
     */
    function teacherBusyInSlot(teacher, day, slotId, forClassId, forSubjectObj, excludeAssignmentId) {
      const t = normalizeTeacherName(teacher);
      if (!t) return false;
      return state.assignments.some(a => {
        if (excludeAssignmentId && a.id === excludeAssignmentId) return false;
        if (a.day !== day || a.slotId !== slotId) return false;
        const os = state.subjects.find(s => s.id === a.subjectId);
        if (!os || normalizeTeacherName(os.teacher) !== t) return false;
        // Same class cell is handled elsewhere
        if (forClassId && a.classId === forClassId) return false;
        // Combined arms + same subject → not busy
        if (forSubjectObj && isCombinedArmAssignment(a, os, forClassId, forSubjectObj)) return false;
        return true;
      });
    }

    function getTeacherClashes() {
      const map = {};
      const subjMap = window._subjectMap || null;
      const clsMap = window._classMap || null;
      const findSubj = subjMap
        ? (id) => subjMap[id]
        : (id) => state.subjects.find(s => s.id === id);
      const findCls = clsMap
        ? (id) => clsMap[id]
        : (id) => state.classes.find(c => c.id === id);
      state.assignments.forEach(a => {
        const subj = findSubj(a.subjectId);
        if (!subj || !subj.teacher) return;
        const key = a.day + '|' + a.slotId + '|' + subj.teacher.toLowerCase().trim();
        if (!map[key]) map[key] = [];
        map[key].push(a);
      });
      const clashes = {};
      Object.keys(map).forEach(key => {
        const arr = map[key];
        if (!arr || arr.length <= 1) return;
        // Not a clash if every lesson is the same subject on arms of the same class (combined)
        const meta = arr.map(a => {
          const subj = findSubj(a.subjectId);
          const cls = findCls(a.classId);
          return {
            nameKey: normalizeSubjectName(subj && subj.name),
            base: getClassArmBase(cls && cls.name)
          };
        });
        const first = meta[0];
        const allCombined = first.base && meta.every(m =>
          m.nameKey === first.nameKey && m.base === first.base
        );
        if (!allCombined) clashes[key] = arr;
      });
      return clashes;
    }

    function isAssignmentInClash(assignmentId, clashes) {
      if (!assignmentId) return false;
      // Fast path during renderTable
      if (window._clashIdSet) return !!window._clashIdSet[assignmentId];
      if (!clashes) return false;
      for (const key in clashes) {
        const arr = clashes[key];
        if (!arr) continue;
        for (let i = 0; i < arr.length; i++) {
          if (arr[i] && arr[i].id === assignmentId) return true;
        }
      }
      return false;
    }

    /** True if day name is Friday (Fri, Friday, etc.). */
    function isFridayDay(day) {
      const d = String(day || '').toLowerCase().trim();
      return d === 'fri' || d === 'friday' || d.indexOf('fri') === 0 || d === 'jumat' || d === 'jumaat' || d === 'jum\'at';
    }

    /** True if slot is Period 9 (by label). */
    function isPeriod9Slot(slot) {
      if (!slot || slot.isBreak) return false;
      const lab = String(slot.label || '').toLowerCase().replace(/\s+/g, ' ').trim();
      return lab === 'period 9' || lab === 'period9' || lab === 'p9' || lab === 'p 9' ||
        /^period\s*0*9$/.test(lab) || /^per\.?\s*0*9$/.test(lab);
    }

    /** Friday + selected JUMAT period is reserved — blocked from teaching (when enabled). */
    function isJumatCell(day, slot) {
      if (state.jumatEnabled === false) return false;
      return isFridayDay(day) && isJumatSlot(slot);
    }

    function toggleJumat(enabled) {
      state.jumatEnabled = !!enabled;
      const tgl = document.getElementById('jumatEnabledToggle');
      if (tgl) tgl.checked = state.jumatEnabled;
      ensureJumatSlotId();
      fillJumatSlotSelect();
      if (state.jumatEnabled) {
        clearJumatAssignments();
        showToast('JUMAT enabled — Friday ' + getJumatSlotLabel() + ' is blocked');
      } else {
        showToast('JUMAT disabled — Friday ' + getJumatSlotLabel() + ' is a normal teaching slot');
      }
      renderTable();
      if (typeof updateConflicts === 'function') updateConflicts();
      if (typeof pushHistory === 'function') pushHistory();
      else if (typeof autosaveNow === 'function') autosaveNow();
      else try { localStorage.setItem('schoolMasterTimetable', JSON.stringify(state)); } catch (e) {}
    }

    function syncJumatToggle() {
      const tgl = document.getElementById('jumatEnabledToggle');
      if (tgl) tgl.checked = state.jumatEnabled !== false;
      fillJumatSlotSelect();
    }

        function jumatCellHtml() {
      return '<td class="slot jumat-slot readonly" title="JUMAT"><div class="jumat-label">JUMAT</div></td>';
    }

    /** Remove teaching assignments on the configured Friday JUMAT period. */
    function clearJumatAssignments() {
      const before = state.assignments.length;
      state.assignments = state.assignments.filter(a => {
        const slot = state.slots.find(s => s.id === a.slotId);
        return !isJumatCell(a.day, slot);
      });
      return before - state.assignments.length;
    }

        function renderTable() {
      const singleWrap = document.getElementById('singleTimetableWrap');
      const compareLayout = document.getElementById('compareLayout');

      if (state.currentView === 'compare') {
        if (singleWrap) singleWrap.style.display = 'none';
        if (compareLayout) compareLayout.style.display = 'grid';
        if (!state.compareLeftView) state.compareLeftView = 'school';
        const sel = document.getElementById('compareLeftViewSelect');
        if (sel) sel.value = state.compareLeftView;

        renderCompareLeft();
        renderCompareRight();

        const titleEl = document.getElementById('viewTitle');
        if (titleEl) {
          const leftName = state.compareLeftView === 'school' ? 'School General' : state.compareLeftView === 'class' ? 'Class' : 'Teacher';
          titleEl.textContent = 'Side by Side — ' + leftName + ' & Teacher';
        }
        applyCompareSchoolCollapse();
        const gc = document.getElementById('gotoControls');
        if (gc) {
          if (state.compareLeftView === 'school') {
            gc.style.display = 'flex';
            setTimeout(buildGoToOptions, 0);
          } else {
            gc.style.display = 'none';
            if (typeof closeGotoPortal === 'function') closeGotoPortal();
          }
        }
        return;
      }

      if (singleWrap) singleWrap.style.display = '';
      if (compareLayout) compareLayout.style.display = 'none';
      renderTableInto(document.getElementById('timetable'), {});
    }

    function renderCompareLeft() {
      const view = state.compareLeftView || 'school';
      const table = document.getElementById('compareSchoolTable');
      const hint = document.getElementById('compareLeftHint');
      const controls = document.getElementById('compareLeftControls');
      if (!table) return;

      if (controls) {
        if (view === 'class') {
          controls.innerHTML = buildCompareLeftClassPickerHtml();
          controls.style.display = 'flex';
          setTimeout(initCompareLeftClassCombo, 0);
        } else if (view === 'teacher') {
          controls.innerHTML = buildCompareLeftTeacherPickerHtml();
          controls.style.display = 'flex';
          setTimeout(initCompareLeftTeacherCombo, 0);
        } else {
          controls.innerHTML = '';
          controls.style.display = 'none';
        }
      }
      if (hint) {
        if (view === 'school') hint.textContent = 'Editable · click any cell';
        else if (view === 'class') {
          const c = state.classes.find(x => x.id === state.compareLeftClassId);
          hint.textContent = c ? c.name + ' · click cells to edit' : 'Select a class below';
        } else if (view === 'teacher') {
          hint.textContent = state.compareLeftTeacher ? state.compareLeftTeacher + ' · click cells to edit' : 'Select a teacher below';
        }
      }

      const savedView = state.currentView;
      const savedClassId = state.selectedClassId;
      const savedTeacher = state.selectedTeacher;

      if (view === 'school') {
        state.currentView = 'school';
        renderTableInto(table, { quiet: true, noEmptyUi: true });
      } else if (view === 'class') {
        if (!state.compareLeftClassId) {
          table.innerHTML = '<tbody><tr><td style="padding:24px;text-align:center;color:var(--muted);">Select a class from the combobox above</td></tr></tbody>';
          table.style.display = 'table';
        } else {
          state.currentView = 'class';
          state.selectedClassId = state.compareLeftClassId;
          renderTableInto(table, { quiet: true, noEmptyUi: true });
        }
      } else if (view === 'teacher') {
        if (!state.compareLeftTeacher) {
          table.innerHTML = '<tbody><tr><td style="padding:24px;text-align:center;color:var(--muted);">Select a teacher from the combobox above</td></tr></tbody>';
          table.style.display = 'table';
        } else {
          state.currentView = 'teacher';
          state.selectedTeacher = state.compareLeftTeacher;
          renderTableInto(table, { quiet: true, noEmptyUi: true });
        }
      }

      state.currentView = savedView;
      state.selectedClassId = savedClassId;
      state.selectedTeacher = savedTeacher;
    }

    function renderCompareRight() {
      const tEmpty = document.getElementById('compareTeacherEmpty');
      const tTable = document.getElementById('compareTeacherTable');
      if (!tTable) return;
      const savedView = state.currentView;
      state.currentView = 'teacher';
      if (!state.selectedTeacher) {
        tTable.style.display = 'none';
        tTable.innerHTML = '';
        if (tEmpty) tEmpty.style.display = 'block';
      } else {
        if (tEmpty) tEmpty.style.display = 'none';
        renderTableInto(tTable, { quiet: true, noEmptyUi: true });
      }
      state.currentView = savedView;
      const label = document.getElementById('compareTeacherLabel');
      if (label) {
        label.textContent = state.selectedTeacher
          ? (state.selectedTeacher + ' · click cells to edit')
          : 'Select a teacher · click cells to edit';
      }
    }

    function switchCompareLeftView(view) {
      state.compareLeftView = view;
      if (view === 'class' && !state.compareLeftClassId && state.classes.length) {
        state.compareLeftClassId = state.classes[0].id;
      }
      if (view === 'teacher' && !state.compareLeftTeacher) {
        const teachers = getAllTeachers();
        if (teachers.length) state.compareLeftTeacher = teachers[0];
      }
      renderCompareLeft();
      const titleEl = document.getElementById('viewTitle');
      if (titleEl) {
        const leftName = view === 'school' ? 'School General' : view === 'class' ? 'Class' : 'Teacher';
        titleEl.textContent = 'Side by Side — ' + leftName + ' & Teacher';
      }
      const gc = document.getElementById('gotoControls');
      if (gc) {
        if (view === 'school') {
          gc.style.display = 'flex';
          setTimeout(buildGoToOptions, 0);
        } else {
          gc.style.display = 'none';
          if (typeof closeGotoPortal === 'function') closeGotoPortal();
        }
      }
      saveState();
    }

    function switchCompareLeftClass(classId) {
      state.compareLeftClassId = classId || null;
      renderCompareLeft();
      saveState();
    }

    function switchCompareLeftTeacher(teacherName) {
      state.compareLeftTeacher = teacherName || null;
      renderCompareLeft();
      saveState();
    }

    function getAllTeachers() {
      const set = new Set();
      state.subjects.forEach(s => {
        if (s.teacher && s.teacher.trim()) set.add(s.teacher.trim());
      });
      return Array.from(set).sort((a,b) => a.localeCompare(b));
    }

    // --- EXACT same comboboxes as normal Class / Teacher timetables, but for left pane ---
    function buildCompareLeftClassPickerHtml() {
      const sel = state.classes.find(c => c.id === state.compareLeftClassId);
      const label = sel ? sel.name : '';
      return (
        '<div class="combo-box teacher-combo" id="compareLeftClassCombo">' +
          '<input type="hidden" id="compareLeftClassSelect" value="' + escapeHtml(state.compareLeftClassId || '') + '" />' +
          '<input type="text" id="compareLeftClassComboInput" class="combo-input" placeholder="Type or choose class…" ' +
            'value="' + escapeHtml(label) + '" autocomplete="off" spellcheck="false" />' +
          '<button type="button" class="combo-toggle" id="compareLeftClassComboToggle" tabindex="-1" aria-label="Open class list">▼</button>' +
        '</div>'
      );
    }

    function buildCompareLeftTeacherPickerHtml() {
      return (
        '<div class="combo-box teacher-combo" id="compareLeftTeacherCombo">' +
          '<input type="hidden" id="compareLeftTeacherSelect" value="' + escapeHtml(state.compareLeftTeacher || '') + '" />' +
          '<input type="text" id="compareLeftTeacherComboInput" class="combo-input" placeholder="Type or choose teacher…" ' +
            'value="' + escapeHtml(state.compareLeftTeacher || '') + '" autocomplete="off" spellcheck="false" />' +
          '<button type="button" class="combo-toggle" id="compareLeftTeacherComboToggle" tabindex="-1" aria-label="Open teacher list">▼</button>' +
        '</div>'
      );
    }

    function initCompareLeftClassCombo() {
      const hidden = document.getElementById('compareLeftClassSelect');
      const input = document.getElementById('compareLeftClassComboInput');
      const toggle = document.getElementById('compareLeftClassComboToggle');
      const box = document.getElementById('compareLeftClassCombo');
      if (!hidden || !input || !toggle || !box) return;

      if (window._compareLeftClassPortal) {
        window._compareLeftClassPortal.remove();
        window._compareLeftClassPortal = null;
      }

      const options = state.classes.map(c => ({ value: c.id, label: c.name }));
      let open = false;
      let highlight = -1;

      const portal = document.createElement('ul');
      portal.className = 'combo-portal-list';
      portal.style.display = 'none';
      document.body.appendChild(portal);
      window._compareLeftClassPortal = portal;

      function filtered() {
        const q = (input.value || '').toLowerCase().trim();
        if (hidden.value) {
          const sel = options.find(o => o.value === hidden.value);
          if (sel && input.value === sel.label) return options.slice();
        }
        if (!q) return options.slice();
        return options.filter(o => o.label.toLowerCase().indexOf(q) !== -1);
      }

      function placePortal() {
        const rect = input.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const width = Math.min(rect.width, vw - 16);
        let left = rect.left;
        if (left + width > vw - 8) left = Math.max(8, vw - 8 - width);
        if (left < 8) left = 8;
        const spaceBelow = vh - rect.bottom - 8;
        const maxH = Math.min(240, Math.max(100, spaceBelow));
        portal.style.left = left + 'px';
        portal.style.top = (rect.bottom + 2) + 'px';
        portal.style.width = width + 'px';
        portal.style.maxHeight = maxH + 'px';
      }

      function renderPortal() {
        const items = filtered();
        if (!items.length) {
          portal.innerHTML = '<li class="combo-empty">No matches</li>';
        } else {
          portal.innerHTML = items.map((o, i) =>
            '<li data-value="' + escapeHtml(o.value) + '" data-label="' + escapeHtml(o.label) + '"' +
            (i === highlight ? ' class="highlight"' : '') + '>' + escapeHtml(o.label) + '</li>'
          ).join('');
        }
      }

      function openList() {
        open = true;
        highlight = 0;
        renderPortal();
        placePortal();
        portal.style.display = 'block';
        toggle.textContent = '▲';
      }

      function closeList(restoreLabel) {
        open = false;
        portal.style.display = 'none';
        toggle.textContent = '▼';
        if (restoreLabel !== false) {
          const sel = options.find(o => o.value === hidden.value);
          input.value = sel ? sel.label : '';
        }
      }

      function selectOpt(value, label) {
        hidden.value = value || '';
        input.value = label || '';
        closeList(false);
        switchCompareLeftClass(value || null);
      }

      input.onfocus = function () { 
        openList(); 
        setTimeout(function(){ try{ input.select(); }catch(e){} }, 15);
      };
      input.onclick = function () { 
        openList(); 
        setTimeout(function(){ try{ input.select(); }catch(e){} }, 15);
      };
      input.oninput = function () {
        const match = options.find(o => o.label.toLowerCase() === (input.value || '').toLowerCase());
        if (match) hidden.value = match.value;
        else {
          const sel = options.find(o => o.value === hidden.value);
          if (!sel || input.value !== sel.label) hidden.value = '';
        }
        openList();
      };
      input.onkeydown = function (e) {
        const items = filtered();
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (!open) openList();
          highlight = Math.min(highlight + 1, items.length - 1);
          renderPortal();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          highlight = Math.max(highlight - 1, 0);
          renderPortal();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (open && items[highlight]) {
            selectOpt(items[highlight].value, items[highlight].label);
          } else if (items.length === 1) {
            selectOpt(items[0].value, items[0].label);
          }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          closeList(true);
          input.blur();
        }
      };

      toggle.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (open) closeList(true);
        else { input.focus(); openList(); }
      };

      portal.onmousedown = function (e) { e.preventDefault(); };
      portal.onclick = function (e) {
        const li = e.target.closest('li[data-value]');
        if (!li) return;
        selectOpt(li.getAttribute('data-value'), li.getAttribute('data-label'));
      };

      if (!window._compareLeftClassDocBound) {
        window._compareLeftClassDocBound = true;
        document.addEventListener('click', function (ev) {
          if (!window._compareLeftClassPortal || window._compareLeftClassPortal.style.display === 'none') return;
          const boxEl = document.getElementById('compareLeftClassCombo');
          if (boxEl && (boxEl.contains(ev.target) || window._compareLeftClassPortal.contains(ev.target))) return;
          const hid = document.getElementById('compareLeftClassSelect');
          const inp = document.getElementById('compareLeftClassComboInput');
          const tog = document.getElementById('compareLeftClassComboToggle');
          if (hid && inp && tog) {
            const sel = state.classes.find(c => c.id === hid.value);
            inp.value = sel ? sel.name : '';
            window._compareLeftClassPortal.style.display = 'none';
            tog.textContent = '▼';
          }
        });
        window.addEventListener('resize', function () {
          if (window._compareLeftClassPortal) window._compareLeftClassPortal.style.display = 'none';
        });
        window.addEventListener('scroll', function () {
          if (window._compareLeftClassPortal) window._compareLeftClassPortal.style.display = 'none';
        }, true);
      }
    }

    function initCompareLeftTeacherCombo() {
      const hidden = document.getElementById('compareLeftTeacherSelect');
      const input = document.getElementById('compareLeftTeacherComboInput');
      const toggle = document.getElementById('compareLeftTeacherComboToggle');
      const box = document.getElementById('compareLeftTeacherCombo');
      if (!hidden || !input || !toggle || !box) return;

      if (window._compareLeftTeacherPortal) {
        window._compareLeftTeacherPortal.remove();
        window._compareLeftTeacherPortal = null;
      }

      const getTeachers = () => {
        const set = new Set();
        state.subjects.forEach(s => { if (s.teacher && s.teacher.trim()) set.add(s.teacher.trim()); });
        return Array.from(set).sort((a,b) => a.localeCompare(b)).map(t => ({ value: t, label: t }));
      };

      let options = getTeachers();
      let open = false;
      let highlight = -1;

      const portal = document.createElement('ul');
      portal.className = 'combo-portal-list';
      portal.style.display = 'none';
      document.body.appendChild(portal);
      window._compareLeftTeacherPortal = portal;

      function filtered() {
        options = getTeachers();
        const q = (input.value || '').toLowerCase().trim();
        if (hidden.value) {
          const sel = options.find(o => o.value === hidden.value);
          if (sel && input.value === sel.label) return options.slice();
        }
        if (!q) return options.slice();
        return options.filter(o => o.label.toLowerCase().indexOf(q) !== -1);
      }

      function placePortal() {
        const rect = input.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const width = Math.min(rect.width, vw - 16);
        let left = rect.left;
        if (left + width > vw - 8) left = Math.max(8, vw - 8 - width);
        if (left < 8) left = 8;
        const spaceBelow = vh - rect.bottom - 8;
        const maxH = Math.min(240, Math.max(100, spaceBelow));
        portal.style.left = left + 'px';
        portal.style.top = (rect.bottom + 2) + 'px';
        portal.style.width = width + 'px';
        portal.style.maxHeight = maxH + 'px';
      }

      function renderPortal() {
        const items = filtered();
        if (!items.length) {
          portal.innerHTML = '<li class="combo-empty">No matches</li>';
        } else {
          portal.innerHTML = items.map((o, i) =>
            '<li data-value="' + escapeHtml(o.value) + '" data-label="' + escapeHtml(o.label) + '"' +
            (i === highlight ? ' class="highlight"' : '') + '>' + escapeHtml(o.label) + '</li>'
          ).join('');
        }
      }

      function openList() {
        open = true;
        highlight = 0;
        renderPortal();
        placePortal();
        portal.style.display = 'block';
        toggle.textContent = '▲';
      }

      function closeList(restoreLabel) {
        open = false;
        portal.style.display = 'none';
        toggle.textContent = '▼';
        if (restoreLabel !== false) {
          const sel = getTeachers().find(o => o.value === hidden.value);
          input.value = sel ? sel.label : '';
        }
      }

      function selectOpt(value, label) {
        hidden.value = value || '';
        input.value = label || '';
        closeList(false);
        switchCompareLeftTeacher(value || null);
      }

      input.onfocus = function () { 
        openList(); 
        setTimeout(function(){ try{ input.select(); }catch(e){} }, 15);
      };
      input.onclick = function () { 
        openList(); 
        setTimeout(function(){ try{ input.select(); }catch(e){} }, 15);
      };
      input.oninput = function () {
        const match = getTeachers().find(o => o.label.toLowerCase() === (input.value || '').toLowerCase());
        if (match) hidden.value = match.value;
        else {
          const sel = getTeachers().find(o => o.value === hidden.value);
          if (!sel || input.value !== sel.label) hidden.value = '';
        }
        openList();
      };
      input.onkeydown = function (e) {
        const items = filtered();
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (!open) openList();
          highlight = Math.min(highlight + 1, items.length - 1);
          renderPortal();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          highlight = Math.max(highlight - 1, 0);
          renderPortal();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (open && items[highlight]) {
            selectOpt(items[highlight].value, items[highlight].label);
          } else if (items.length === 1) {
            selectOpt(items[0].value, items[0].label);
          }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          closeList(true);
          input.blur();
        }
      };

      toggle.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (open) closeList(true);
        else { input.focus(); openList(); }
      };

      portal.onmousedown = function (e) { e.preventDefault(); };
      portal.onclick = function (e) {
        const li = e.target.closest('li[data-value]');
        if (!li) return;
        selectOpt(li.getAttribute('data-value'), li.getAttribute('data-label'));
      };

      if (!window._compareLeftTeacherDocBound) {
        window._compareLeftTeacherDocBound = true;
        document.addEventListener('click', function (ev) {
          if (!window._compareLeftTeacherPortal || window._compareLeftTeacherPortal.style.display === 'none') return;
          const boxEl = document.getElementById('compareLeftTeacherCombo');
          if (boxEl && (boxEl.contains(ev.target) || window._compareLeftTeacherPortal.contains(ev.target))) return;
          const hid = document.getElementById('compareLeftTeacherSelect');
          const inp = document.getElementById('compareLeftTeacherComboInput');
          if (hid && inp) {
            inp.value = hid.value || '';
            window._compareLeftTeacherPortal.style.display = 'none';
            const tog = document.getElementById('compareLeftTeacherComboToggle');
            if (tog) tog.textContent = '▼';
          }
        });
        window.addEventListener('resize', function () {
          if (window._compareLeftTeacherPortal) window._compareLeftTeacherPortal.style.display = 'none';
        });
        window.addEventListener('scroll', function () {
          if (window._compareLeftTeacherPortal) window._compareLeftTeacherPortal.style.display = 'none';
        }, true);
      }
    }


    function slugifyForId(s) {
      if (!s) return 'x';
      return String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'') || 'x';
    }
    // Alias for early use (in case late definition overwrites)
    window.slugifyForId = slugifyForId;

        function renderTableInto(table, opts) {
      opts = opts || {};
      if (!table) return;
      const emptyView = opts.noEmptyUi ? null : document.getElementById('emptyView');
      const view = state.currentView;

      const activeSlots = (view === 'exam')
        ? (state.examSlots || [])
        : (view === 'study' && typeof getStudySlots === 'function')
          ? getStudySlots()
          : state.slots;
      if (activeSlots.length === 0) {
        table.style.display = 'none';
        if (emptyView) {
          emptyView.style.display = 'block';
          document.getElementById('emptyMessage').textContent = view === 'exam'
            ? 'Add Exam/CA periods and breaks in the sidebar first.'
            : 'Add periods and breaks first.';
        }
        return;
      }
      if (view === 'study' && (!(state.days || []).length)) {
        table.style.display = 'none';
        if (emptyView) {
          emptyView.style.display = 'block';
          document.getElementById('emptyMessage').textContent = 'Set weekdays in Settings first.';
        }
        return;
      }
      if (view === 'study' && typeof getStudySlots === 'function' && !getStudySlots().length) {
        table.style.display = 'none';
        if (emptyView) {
          emptyView.style.display = 'block';
          document.getElementById('emptyMessage').textContent = 'Add custom study periods in Setup → Study subjects, or choose “Same as school periods”.';
        }
        return;
      }

      if (view === 'class' && !state.selectedClassId) {
        table.style.display = 'none';
        if (emptyView) {
          emptyView.style.display = 'block';
          document.getElementById('emptyMessage').textContent = 'Select a class from the dropdown above.';
        }
        return;
      }
      if (view === 'teacher' && !state.selectedTeacher) {
        table.style.display = 'none';
        if (emptyView) {
          emptyView.style.display = 'block';
          document.getElementById('emptyMessage').textContent = 'Select a teacher from the dropdown above.';
        }
        return;
      }
      if ((view === 'school' || view === 'exam') && state.classes.length === 0) {
        table.style.display = 'none';
        if (emptyView) {
          emptyView.style.display = 'block';
          document.getElementById('emptyMessage').textContent = view === 'exam'
            ? 'Add classes (arms) first to build the Exam / CA timetable.'
            : 'Add classes first — each class will appear for every day of the week.';
        }
        return;
      }

      if (emptyView) emptyView.style.display = 'none';
      table.style.display = 'table';

      // Performance: one-time indexes for large school grids (1000+ periods)
      invalidateLookupCaches();
      window._assignIndex = buildAssignmentIndex();
      window._subjectMap = {};
      (state.subjects || []).forEach(s => { window._subjectMap[s.id] = s; });
      window._classMap = {};
      (state.classes || []).forEach(c => { window._classMap[c.id] = c; });
      const clashes = getTeacherClashes();
      window._clashIdSet = buildClashIdSet(clashes);
      const examClashes = getExamDutyClashes();
      const editable = (view === 'school' || view === 'teacher' || view === 'class' || view === 'exam' || view === 'study');

      // Header
      let html = '<thead><tr><th class="day-header">Day</th>';
      if (view === 'school' || view === 'exam') {
        html += '<th class="class-header">Class</th>';
      }
      activeSlots.forEach(slot => {
        const timeStr = (slot.start && slot.end) ? '<span class="slot-time">' + slot.start + '–' + slot.end + '</span>' : '';
        const breakClass = slot.isBreak ? 'break-header' : '';
        if (slot.isBreak) {
          html += '<th class="' + breakClass + '" title="' + escapeHtml(slot.label) + (slot.start && slot.end ? ' (' + slot.start + '–' + slot.end + ')' : '') + '"></th>';
        } else {
          if (state.usePerDayTimes) {
            html += '<th class="' + breakClass + '">' + escapeHtml(slot.label) + '</th>';
          } else {
            html += '<th class="' + breakClass + '">' + escapeHtml(slot.label) + timeStr + '</th>';
          }
        }
      });
      html += '</tr></thead><tbody>';

      if (view === 'study') {
        const days = state.days || [];
        const studyMap = {};
        (state.studyAssignments || []).forEach(function (a) {
          const k = a.day + '|' + a.slotId;
          studyMap[k] = a;
        });
        const subjMap = {};
        (state.studySubjects || []).forEach(function (s) { subjMap[s.id] = s; });
        if (!(state.studySubjects || []).length) {
          html += '<tr><td colspan="' + (1 + activeSlots.length) + '" style="text-align:center;padding:28px;color:var(--muted);">Add study subjects in <strong>Setup → Study subjects</strong>, set periods per week, then use <strong>Auto-generate study plan</strong>.</td></tr>';
        } else {
          days.forEach(function (day) {
            html += '<tr>';
            html += '<td class="day-cell">' + escapeHtml(day) + '</td>';
            activeSlots.forEach(function (slot) {
              if (slot.isBreak) {
                html += '<td class="slot break-slot" title="' + escapeHtml(slot.label) + '"><div class="break-label">' + escapeHtml(slot.label) + '</div></td>';
                return;
              }
              const a = studyMap[day + '|' + slot.id];
              const timeStr = (slot.start && slot.end) ? (slot.start + '–' + slot.end) : '';
              const click = 'onclick="openStudyAssignModal(\'' + String(day).replace(/'/g, "\\'") + '\', \'' + slot.id + '\')"';
              html += '<td class="slot" style="cursor:pointer;" title="Click to set study subject" ' + click + '>';
              html += '<div class="slot-entries">';
              if (!a) {
                html += '<div class="slot-add-hint">+ Study</div>';
              } else {
                const subj = subjMap[a.subjectId];
                const bg = (subj && subj.color) ? subj.color : '#0284c7';
                html += '<div class="entry" style="background:' + bg + '">' +
                  '<div class="entry-subj">' + escapeHtml(subj ? subj.name : 'Study') + '</div>' +
                  (timeStr ? '<div class="entry-room">' + escapeHtml(timeStr) + '</div>' : '') +
                  '</div>';
              }
              html += '</div></td>';
            });
            html += '</tr>';
          });
        }
      } else if (view === 'exam') {
        const examDays = getExamSchedule();
        if (!examDays.length) {
          html += '<tr><td colspan="' + (2 + activeSlots.length) + '" style="text-align:center;padding:24px;color:var(--muted);">Select Exam/CA days &amp; dates in the sidebar first.</td></tr>';
        }
        examDays.forEach((row) => {
          const day = examDayKey(row);
          const dayName = row.day;
          const dateLabel = formatExamDate(row.date);
          state.classes.forEach((cls, clsIdx) => {
            const dayStart = clsIdx === 0 ? 'day-start' : '';
            const dayEnd = clsIdx === state.classes.length - 1 ? 'day-end' : '';
            html += '<tr class="' + dayStart + ' ' + dayEnd + '">';
            html += '<td class="day-cell">' + escapeHtml(dayName) +
              (dateLabel ? '<div class="exam-date-label" style="font-size:0.72em;font-weight:600;color:#475569;margin-top:2px;">' + escapeHtml(dateLabel) + '</div>' : '') +
              '</td>';
            html += '<td class="class-cell">' + escapeHtml(cls.name) + '</td>';
            activeSlots.forEach(slot => {
              if (slot.isBreak) {
                html += '<td class="slot break-slot" title="' + escapeHtml(slot.label) + '"><div class="break-label">' + escapeHtml(slot.label) + '</div></td>';
                return;
              }
              const sessions = getExamsForSlot(day, slot.id).filter(e => e.classId === cls.id);
              const slotHasClash = sessions.some(e => isExamInClash(e.id, examClashes));
              const clickHandler = 'onclick="openExamModal(\'' + day + '\', \'' + slot.id + '\', \'' + cls.id + '\')"';
              html += '<td class="slot ' + (slotHasClash ? 'has-clash ' : '') + '" ' + clickHandler + '><div class="slot-entries">';
              if (sessions.length === 0) {
                html += '<div class="slot-add-hint">+ Exam/CA</div>';
              } else {
                sessions.forEach(e => {
                  const subj = state.subjects.find(s => s.id === e.subjectId);
                  const inClash = isExamInClash(e.id, examClashes);
                  const bg = subj ? subj.color : '#64748b';
                  html += '<div class="entry ' + (inClash ? 'clash' : '') + '" style="background:' + bg + '">' +
                    '<div class="entry-subj">' + escapeHtml(subj ? subj.name : 'Exam') + '</div>' +
                    '<div class="entry-teacher">Inv: ' + escapeHtml(e.invigilator || '—') + '</div>' +
                    '<div class="entry-room">Sup: ' + escapeHtml(e.supervisor || '—') + '</div></div>';
                });
              }
              html += '</div></td>';
            });
            html += '</tr>';
          });
        });
      } else if (view === 'school') {
        // Every class appears under every day
        state.days.forEach((day, dayIdx) => {
          state.classes.forEach((cls, clsIdx) => {
            const dayStart = clsIdx === 0 ? 'day-start' : '';
            const dayEnd = clsIdx === state.classes.length - 1 ? 'day-end' : '';
            const rowId = 'goto-' + slugifyForId(day) + '-' + slugifyForId(cls.id);
            html += '<tr id="' + rowId + '" class="' + dayStart + ' ' + dayEnd + '" data-goto-day="' + escapeHtml(day) + '" data-goto-class="' + escapeHtml(cls.name) + '">';
            html += '<td class="day-cell">' + escapeHtml(day) + '</td>';
            html += '<td class="class-cell">' + escapeHtml(cls.name) + '</td>';

            state.slots.forEach(slot => {
              if (slot.isBreak) {
                html += '<td class="slot break-slot" title="' + escapeHtml(slot.label) + '"><div class="break-label">' + escapeHtml(slot.label) + '</div></td>';
                return;
              }
              if (isJumatCell(day, slot)) {
                html += jumatCellHtml();
                return;
              }

              const entries = getAssignmentsForSlotClass(day, slot.id, cls.id);
              const slotHasClash = entries.some(e => isAssignmentInClash(e.id, clashes));
              // forceTeacherCtx=false → school/class edit (works in School tab and Side-by-Side left)
              const clickHandler = 'onclick="openAssignModal(\'' + day + '\', \'' + slot.id + '\', \'' + cls.id + '\', false)"';

              const assignIds = entries.map(e => e.id).filter(Boolean).join(',');
              const dayTime = getSlotTime(day, slot.id);
              const timeBadge = (state.usePerDayTimes && !slot.isBreak) ? '<div class="slot-time-badge">' + escapeHtml((dayTime.start||'') + (dayTime.end ? '–' + dayTime.end : '')) + '</div>' : '';
              html += '<td class="slot ' + (slotHasClash ? 'has-clash ' : '') + '" style="cursor:pointer;" title="Click to add or edit · right-click for free move slots" ' +
                ' ondragover="handleSlotDragOver(event)" ondrop="handleSlotDrop(event)" ondragleave="handleSlotDragLeave(event)" ondragenter="handleSlotDragEnter(event)"data-day="' + escapeHtml(day) + '" data-slot-id="' + escapeHtml(slot.id) + '" data-class-id="' + escapeHtml(cls.id) + '" ' +
                (assignIds ? 'data-assign-ids="' + escapeHtml(assignIds) + '" ' : '') +
                clickHandler + '>' + timeBadge + '<div class="slot-entries">';

              if (entries.length === 0) {
                html += '<div class="slot-add-hint">+ Add</div>';
              } else {
                html += renderGroupedEntriesHtml(entries, day, slot, false);
              }
              html += '</div></td>';
            });
            html += '</tr>';
          });
        });
      } else {
        // Class or Teacher view: one row per day
        state.days.forEach(day => {
          html += '<tr><td class="day-cell">' + escapeHtml(day) + '</td>';

          state.slots.forEach(slot => {
            if (slot.isBreak) {
              html += '<td class="slot break-slot" title="' + escapeHtml(slot.label) + '"><div class="break-label">' + escapeHtml(slot.label) + '</div></td>';
              return;
            }
            if (isJumatCell(day, slot)) {
              html += jumatCellHtml();
              return;
            }

            let entries = getAssignmentsForSlot(day, slot.id);

            if (view === 'class') {
              entries = entries.filter(e => e.classId === state.selectedClassId);
            } else if (view === 'teacher') {
              entries = entries.filter(e => {
                const subj = state.subjects.find(s => s.id === e.subjectId);
                return subj && subj.teacher.trim().toLowerCase() === state.selectedTeacher.toLowerCase();
              });
            }

            const slotHasClash = entries.some(e => isAssignmentInClash(e.id, clashes));
            if (view === 'teacher') {
              // forceTeacherCtx=true so Side-by-Side right panel stays editable for this teacher
              const clickHandler = 'onclick="openAssignModal(\'' + day + '\', \'' + slot.id + '\', null, true)"';
              const assignIdsT = entries.map(e => e.id).filter(Boolean).join(',');
              const dayTimeT = getSlotTime(day, slot.id);
              const timeBadgeT = (state.usePerDayTimes && !slot.isBreak) ? '<div class="slot-time-badge">' + escapeHtml((dayTimeT.start||'') + (dayTimeT.end ? '–' + dayTimeT.end : '')) + '</div>' : '';
              html += '<td class="slot ' + (slotHasClash ? 'has-clash ' : '') + '" style="cursor:pointer;" title="Click to add or edit · right-click for free move slots" ' +
                ' ondragover="handleSlotDragOver(event)" ondrop="handleSlotDrop(event)" ondragleave="handleSlotDragLeave(event)" ondragenter="handleSlotDragEnter(event)"data-day="' + escapeHtml(day) + '" data-slot-id="' + escapeHtml(slot.id) + '" ' +
                (assignIdsT ? 'data-assign-ids="' + escapeHtml(assignIdsT) + '" ' : '') +
                clickHandler + '>' + timeBadgeT + '<div class="slot-entries">';
              if (entries.length === 0) {
                html += '<div class="slot-add-hint">+ Add</div>';
              } else {
                html += renderGroupedEntriesHtml(entries, day, slot, true);
              }
              html += '</div></td>';
            } else if (view === 'class') {
              // Editable class timetable — preselect this class in the assign modal
              const classId = state.selectedClassId || '';
              const clickHandler = 'onclick="openAssignModal(\'' + day + '\', \'' + slot.id + '\', \'' + classId + '\', false)"';
              const assignIdsC = entries.map(e => e.id).filter(Boolean).join(',');
              const dayTimeC = getSlotTime(day, slot.id);
              const timeBadgeC = (state.usePerDayTimes && !slot.isBreak) ? '<div class="slot-time-badge">' + escapeHtml((dayTimeC.start||'') + (dayTimeC.end ? '–' + dayTimeC.end : '')) + '</div>' : '';
              html += '<td class="slot ' + (slotHasClash ? 'has-clash ' : '') + '" style="cursor:pointer;" title="Click to add or edit · right-click for free move slots" ' +
                ' ondragover="handleSlotDragOver(event)" ondrop="handleSlotDrop(event)" ondragleave="handleSlotDragLeave(event)" ondragenter="handleSlotDragEnter(event)"data-day="' + escapeHtml(day) + '" data-slot-id="' + escapeHtml(slot.id) + '" data-class-id="' + escapeHtml(classId) + '" ' +
                (assignIdsC ? 'data-assign-ids="' + escapeHtml(assignIdsC) + '" ' : '') +
                clickHandler + '>' + timeBadgeC + '<div class="slot-entries">';
              if (entries.length === 0) {
                html += '<div class="slot-add-hint">+ Add</div>';
              } else {
                html += renderGroupedEntriesHtml(entries, day, slot, false);
              }
              html += '</div></td>';
            } else {
              html += '<td class="slot readonly"><div class="slot-entries">';
              if (entries.length === 0) {
                html += '<div class="slot-add-hint" style="opacity:0.3;">—</div>';
              } else {
                entries.forEach(e => {
                  const cls = state.classes.find(c => c.id === e.classId);
                  const subj = state.subjects.find(s => s.id === e.subjectId);
                  if (!cls || !subj) return;
                  html += '<div class="entry" style="background:' + subj.color + '">' +
                    '<div class="entry-subj">' + escapeHtml(subj.name) + '</div>' +
                    '<div class="entry-teacher">' + escapeHtml(subj.teacher) + '</div>' +
                    (subj.room ? '<div class="entry-room">' + escapeHtml(subj.room) + '</div>' : '') + '</div>';
                });
              }
              html += '</div></td>';
            }
          });
          html += '</tr>';
        });
      }

      html += '</tbody>';
      table.innerHTML = html;
      if (!opts.quiet) bindMoveHintHandlers(table);

      if (!opts.quiet) {
        if (view === 'class' && state.selectedClassId) {
          const c = state.classes.find(x => x.id === state.selectedClassId);
          const main = 'Class Timetable — ' + (c ? c.name : '');
          if (state.showClassLoad !== false) {
            setViewTitle(main, false, getClassPeriodTotals(state.selectedClassId));
          } else {
            document.getElementById('viewTitle').textContent = main;
          }
        } else if (view === 'class') {
          document.getElementById('viewTitle').textContent = 'Select a class';
        } else if (view === 'teacher' && state.selectedTeacher) {
          const main = 'Teacher Timetable — ' + state.selectedTeacher;
          if (state.showTeacherLoad !== false) {
            setViewTitle(main, false, getTeacherPeriodTotals(state.selectedTeacher));
          } else {
            setViewTitle(main, false, null);
          }
        } else if (view === 'teacher') {
          setViewTitle('Select a teacher', false, null);
        } else if (view === 'school') {
          setViewTitle('School General Timetable', false, getSchoolPeriodTotals());
          setTimeout(buildGoToOptions, 0);
        } else if (view === 'exam') {
          document.getElementById('viewTitle').textContent = 'Exam / CA Timetable';
        }
      }
    }


    function populateAssignDayPeriodSelects(){
      const daySel = document.getElementById('assignDay');
      const periodSel = document.getElementById('assignPeriod');
      if (!daySel || !periodSel) return;
      const cur = state.currentSlot || { day: (state.days[0]||'Mon'), slotId: (state.slots[0]||{}).id };
      // Days
      daySel.innerHTML = (state.days||[]).map(d=> '<option value="'+escapeHtml(d)+'"'+(d===cur.day?' selected':'')+'>'+escapeHtml(d)+'</option>').join('');
      // Periods - only teaching slots + break/jumat disabled? Show all but disable breaks
      const teaching = state.slots||[];
      periodSel.innerHTML = teaching.map(sl=>{
        const isBreak = !!sl.isBreak;
        const isJumat = isJumatCell(cur.day, sl);
        const label = sl.label + (sl.start?' ('+sl.start+'-'+sl.end+')':'') + (isBreak?' - BREAK':'') + (isJumat?' - JUMAT':'');
        const disabled = isBreak ? ' disabled' : '';
        const sel = sl.id===cur.slotId ? ' selected' : '';
        return '<option value="'+escapeHtml(sl.id)+'"'+sel+disabled+'>'+escapeHtml(label)+'</option>';
      }).join('');
    }
    function onAssignDayChange(newDay){
      if (!state.currentSlot) return;
      const old = state.currentSlot;
      const newSlotId = old.slotId;
      // check JUMAT
      const slotObj = state.slots.find(s=>s.id===newSlotId);
      if (slotObj && isJumatCell(newDay, slotObj)) {
        showToast('JUMAT — Friday '+getJumatSlotLabel()+' is blocked');
        // revert select
        populateAssignDayPeriodSelects();
        return;
      }
      state.currentSlot = { day: newDay, slotId: newSlotId };
      // update title and slot label
      const slot = state.slots.find(s=>s.id===newSlotId);
      document.getElementById('assignModalTitle').textContent = (slot?slot.label:'')+' · '+newDay + (state.selectedTeacher?' · '+state.selectedTeacher:'');
      document.getElementById('assignSlotLabel').textContent = (slot && slot.start && slot.end) ? (slot.start+' – '+slot.end) : '';
      renderModalEntries();
      checkPotentialClash();
      checkQuotaWarning();
      checkSameDayWarning();
      updateTopSubjectPlacements();
      populateAssignDayPeriodSelects();
    }
    function onAssignPeriodChange(newSlotId){
      if (!state.currentSlot) return;
      const old = state.currentSlot;
      const newDay = old.day;
      const slotObj = state.slots.find(s=>s.id===newSlotId);
      if (!slotObj) return;
      if (slotObj.isBreak) { showToast('Break period cannot be assigned'); populateAssignDayPeriodSelects(); return; }
      if (isJumatCell(newDay, slotObj)) { showToast('JUMAT — Friday '+getJumatSlotLabel()+' is blocked'); populateAssignDayPeriodSelects(); return; }
      state.currentSlot = { day: newDay, slotId: newSlotId };
      const slot = slotObj;
      document.getElementById('assignModalTitle').textContent = slot.label+' · '+newDay + (state.selectedTeacher?' · '+state.selectedTeacher:'');
      document.getElementById('assignSlotLabel').textContent = (slot.start && slot.end) ? (slot.start+' – '+slot.end) : '';
      renderModalEntries();
      checkPotentialClash();
      checkQuotaWarning();
      checkSameDayWarning();
      updateTopSubjectPlacements();
      populateAssignDayPeriodSelects();
    }
    function navigateAssignSlot(dayDelta, periodDelta){
      if (!state.currentSlot) return;
      let dayIdx = (state.days||[]).indexOf(state.currentSlot.day);
      let slotIdx = (state.slots||[]).findIndex(s=>s.id===state.currentSlot.slotId);
      if (dayDelta!==0) {
        let newDayIdx = dayIdx + (dayDelta>0?1:-1);
        if (newDayIdx<0) newDayIdx = (state.days.length-1);
        if (newDayIdx>=state.days.length) newDayIdx = 0;
        const newDay = state.days[newDayIdx];
        const slotObj = state.slots.find(s=>s.id===state.currentSlot.slotId);
        if (slotObj && isJumatCell(newDay, slotObj)) {
          // try to skip JUMAT by moving period as well? Just block and try next day
          showToast('Skipping JUMAT blocked slot');
          // find next non-JUMAT day
          let tries=0;
          while(tries<state.days.length){
            tries++;
            newDayIdx = (newDayIdx + (dayDelta>0?1:-1) + state.days.length) % state.days.length;
            const d = state.days[newDayIdx];
            if (!isJumatCell(d, slotObj)) { onAssignDayChange(d); return; }
          }
          return;
        }
        onAssignDayChange(newDay);
        return;
      }
      if (periodDelta!==0) {
        // find next non-break slot
        let newSlotIdx = slotIdx;
        let tries=0;
        while(tries < (state.slots.length*2)){
          tries++;
          newSlotIdx = (newSlotIdx + (periodDelta>0?1:-1) + state.slots.length) % state.slots.length;
          const sl = state.slots[newSlotIdx];
          if (!sl) continue;
          if (sl.isBreak) continue;
          if (isJumatCell(state.currentSlot.day, sl)) continue;
          onAssignPeriodChange(sl.id);
          return;
        }
      }
    }

    function openAssignModal(day, slotId, preselectClassId, forceTeacherCtx, focusedSubjectId, focusedClassId) {
      if (focusedSubjectId && focusedClassId) { window._lastClickedSubjectId = focusedSubjectId; window._lastClickedClassId = focusedClassId; } else { const chk = (typeof getAssignmentsForSlot === 'function') ? getAssignmentsForSlot(day, slotId) : []; if (chk.length === 0) { window._lastClickedSubjectId = null; window._lastClickedClassId = null; } }

      if (state.currentView !== 'school' && state.currentView !== 'teacher' && state.currentView !== 'compare' && state.currentView !== 'class') return;
      const slot = state.slots.find(s => s.id === slotId);
      if (!slot || slot.isBreak) return;
      if (isJumatCell(day, slot)) {
        showToast('JUMAT — Friday ' + getJumatSlotLabel() + ' is blocked for all classes');
        return;
      }

      state.currentSlot = { day, slotId };
      window._forceAddActive = false;
      try{ populateAssignDayPeriodSelects(); }catch(e){}
      // Teacher context only when explicitly from Teacher tab / Side-by-Side right panel
      const useTeacherCtx = forceTeacherCtx === true ||
        (forceTeacherCtx !== false && state.currentView === 'teacher');
      const teacherCtx = (useTeacherCtx && state.selectedTeacher) ? state.selectedTeacher : null;
      const titleExtra = teacherCtx ? ' · ' + teacherCtx : '';
      document.getElementById('assignModalTitle').textContent = slot.label + ' · ' + day + titleExtra;
      document.getElementById('assignSlotLabel').textContent = (slot.start && slot.end) ? (slot.start + ' – ' + slot.end) : '';

      function buildAssignSubjectOptions() {
        const cid = (document.getElementById('assignClass') || {}).value || '';
        let list = state.subjects.slice();
        if (teacherCtx) {
          list = list.filter(s => (s.teacher || '').trim().toLowerCase() === teacherCtx.toLowerCase());
        }
        return list.map(s => {
          const q = cid ? getQuotaFor(s.id, cid) : 0;
          const n = cid ? countSubjectForClass(s.id, cid) : 0;
          const full = cid && q > 0 && n >= q;
          const zero = cid && q === 0;
          const dual = cid ? findOtherTeacherForSubjectInClass(s.name, s.teacher, cid, s.id) : null;
          let label = s.name + ' (' + (s.teacher || '?') + ')';
          if (cid) label += ' — ' + n + '/' + q;
          if (full) label += ' [FULL]';
          if (zero) label += ' [0×/week]';
          if (dual) label += ' [other teacher: ' + ((dual.subject && dual.subject.teacher) || '?') + ']';
          const disabled = !!(full || zero || dual);
          return { value: s.id, label: label, disabled: disabled, search: (s.name + ' ' + (s.teacher || '')).toLowerCase() };
        });
      }

      function fillSubjectOptions() {
        initAssignSubjectCombo(true);
      }
      window._fillSubjectOptions = fillSubjectOptions;
      window._buildAssignSubjectOptions = buildAssignSubjectOptions;

      window.onAssignClassChange = function () {
        if (window._fillSubjectOptions) window._fillSubjectOptions();
        checkPotentialClash();
        checkQuotaWarning();
        checkSameDayWarning();
        updateTopSubjectPlacements();
      };

      renderModalEntries();
      checkPotentialClash();
      checkQuotaWarning();
      checkSameDayWarning();
      updateTopSubjectPlacements();
      const _assignOverlay = document.getElementById('assignModal');
      _assignOverlay.classList.add('open');

      // ONLY auto-scroll to bottom on open - do NOT open class/subject dropdowns
      setTimeout(() => {
        const _modal = _assignOverlay.querySelector('.modal');
        if (_modal) {
          _modal.scrollTo({ top: _modal.scrollHeight, behavior: 'smooth' });
        }
      }, 80);

      // Comboboxes after modal is open (layout ready) - keep closed
      initAssignClassCombo(preselectClassId || '');
      initAssignSubjectCombo(false);
      setTimeout(() => {
        updateTopSubjectPlacements();
        const subjHidden = document.getElementById('assignSubject');
        if (subjHidden) {
          let lastVal = subjHidden.value;
          setInterval(() => {
            if (subjHidden.value !== lastVal) {
              lastVal = subjHidden.value;
              updateTopSubjectPlacements();
            }
          }, 300);
        }
      }, 150);
    }

    /** Reliable class combobox: list portal on document.body, aligned under input */
    function initAssignClassCombo(preselectId) {
      const hidden = document.getElementById('assignClass');
      const input = document.getElementById('assignClassInput');
      const toggle = document.getElementById('assignClassToggle');
      const box = document.getElementById('assignClassCombo');
      if (!hidden || !input || !toggle || !box) return;

      // Tear down previous portal
      if (window._assignClassPortal) {
        window._assignClassPortal.remove();
        window._assignClassPortal = null;
      }

      const options = state.classes.map(c => ({ value: c.id, label: c.name }));
      let open = false;
      let highlight = -1;

      // Set initial value
      const pre = options.find(o => o.value === preselectId);
      hidden.value = pre ? pre.value : '';
      input.value = pre ? pre.label : '';

      const portal = document.createElement('ul');
      portal.className = 'combo-portal-list';
      portal.style.display = 'none';
      document.body.appendChild(portal);
      window._assignClassPortal = portal;

      function filtered() {
        const q = (input.value || '').toLowerCase().trim();
        // If current text is exactly the selected label, show all
        if (hidden.value) {
          const sel = options.find(o => o.value === hidden.value);
          if (sel && input.value === sel.label) return options.slice();
        }
        if (!q) return options.slice();
        return options.filter(o => o.label.toLowerCase().indexOf(q) !== -1);
      }

      function placePortal() {
        const rect = input.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const width = Math.min(rect.width, vw - 16);
        let left = rect.left;
        if (left + width > vw - 8) left = Math.max(8, vw - 8 - width);
        if (left < 8) left = 8;
        const spaceBelow = vh - rect.bottom - 8;
        const maxH = Math.min(240, Math.max(100, spaceBelow));
        portal.style.left = left + 'px';
        portal.style.top = (rect.bottom + 2) + 'px';
        portal.style.width = width + 'px';
        portal.style.maxHeight = maxH + 'px';
      }

      function renderPortal() {
        const items = filtered();
        if (!items.length) {
          portal.innerHTML = '<li class="combo-empty">No matches</li>';
        } else {
          portal.innerHTML = items.map((o, i) =>
            '<li data-value="' + escapeHtml(o.value) + '" data-label="' + escapeHtml(o.label) + '"' +
            (i === highlight ? ' class="highlight"' : '') + '>' + escapeHtml(o.label) + '</li>'
          ).join('');
        }
      }

      function openList() {
        open = true;
        highlight = 0;
        renderPortal();
        placePortal();
        portal.style.display = 'block';
        toggle.textContent = '▲';
      }

      function closeList(restoreLabel) {
        open = false;
        portal.style.display = 'none';
        toggle.textContent = '▼';
        if (restoreLabel !== false) {
          const sel = options.find(o => o.value === hidden.value);
          input.value = sel ? sel.label : '';
        }
      }

      function selectOpt(value, label) {
        hidden.value = value || '';
        input.value = label || '';
        closeList(false);
        if (typeof window.onAssignClassChange === 'function') window.onAssignClassChange();
      }

      input.onfocus = function () { 
        openList(); 
        setTimeout(function(){ try{ input.select(); }catch(e){} }, 15);
      };
      input.onclick = function () { 
        openList(); 
        setTimeout(function(){ try{ input.select(); }catch(e){} }, 15);
      };
      input.oninput = function () {
        // Typing clears selection until a match is chosen
        const match = options.find(o => o.label.toLowerCase() === (input.value || '').toLowerCase());
        if (match) hidden.value = match.value;
        else if (!(hidden.value && options.find(o => o.value === hidden.value && o.label === input.value))) {
          // keep hidden if still showing selected label, else clear
          const sel = options.find(o => o.value === hidden.value);
          if (!sel || input.value !== sel.label) hidden.value = '';
        }
        openList();
      };
      input.onkeydown = function (e) {
        const items = filtered();
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (!open) openList();
          highlight = Math.min(highlight + 1, items.length - 1);
          renderPortal();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          highlight = Math.max(highlight - 1, 0);
          renderPortal();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (open && items[highlight]) {
            selectOpt(items[highlight].value, items[highlight].label);
          } else if (items.length === 1) {
            selectOpt(items[0].value, items[0].label);
          }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          closeList(true);
          input.blur();
        }
      };

      toggle.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (open) closeList(true);
        else { input.focus(); openList(); }
      };

      portal.onmousedown = function (e) { e.preventDefault(); };
      portal.onclick = function (e) {
        const li = e.target.closest('li[data-value]');
        if (!li) return;
        selectOpt(li.getAttribute('data-value'), li.getAttribute('data-label'));
      };

      if (!window._assignComboDocBound) {
        window._assignComboDocBound = true;
        document.addEventListener('click', function (ev) {
          if (!window._assignClassPortal || window._assignClassPortal.style.display === 'none') return;
          const boxEl = document.getElementById('assignClassCombo');
          if (boxEl && (boxEl.contains(ev.target) || window._assignClassPortal.contains(ev.target))) return;
          const inp = document.getElementById('assignClassInput');
          const hid = document.getElementById('assignClass');
          if (inp && hid) {
            const opt = state.classes.find(c => c.id === hid.value);
            inp.value = opt ? opt.name : '';
          }
          window._assignClassPortal.style.display = 'none';
          const tog = document.getElementById('assignClassToggle');
          if (tog) tog.textContent = '▼';
        });
        window.addEventListener('resize', function () {
          if (window._assignClassPortal && window._assignClassPortal.style.display !== 'none') {
            const inp = document.getElementById('assignClassInput');
            if (!inp) return;
            const rect = inp.getBoundingClientRect();
            const vw = window.innerWidth;
            const width = Math.min(rect.width, vw - 16);
            let left = rect.left;
            if (left + width > vw - 8) left = Math.max(8, vw - 8 - width);
            window._assignClassPortal.style.left = left + 'px';
            window._assignClassPortal.style.top = (rect.bottom + 2) + 'px';
            window._assignClassPortal.style.width = width + 'px';
          }
        });
      }

      if (pre) {
        if (typeof window.onAssignClassChange === 'function') window.onAssignClassChange();
      }
    }

    /** Subject (Teacher) combobox for Add assignment */
    function initAssignSubjectCombo(preserveValue) {
      const hidden = document.getElementById('assignSubject');
      const input = document.getElementById('assignSubjectInput');
      const toggle = document.getElementById('assignSubjectToggle');
      const box = document.getElementById('assignSubjectCombo');
      if (!hidden || !input || !toggle || !box) return;

      if (window._assignSubjectPortal) {
        window._assignSubjectPortal.remove();
        window._assignSubjectPortal = null;
      }

      const buildOpts = window._buildAssignSubjectOptions || function () { return []; };
      let options = buildOpts();
      let open = false;
      let highlight = -1;

      const prevVal = preserveValue ? (hidden.value || '') : '';
      const prevOpt = options.find(o => o.value === prevVal && !o.disabled);
      // Prefer first enabled option if previous is missing/disabled
      const initial = prevOpt || options.find(o => !o.disabled) || null;
      hidden.value = initial ? initial.value : '';
      input.value = initial ? initial.label : '';
      input.placeholder = options.length ? 'Type or choose subject (teacher)…' : 'No subjects – add some first';

      const portal = document.createElement('ul');
      portal.className = 'combo-portal-list';
      portal.style.display = 'none';
      document.body.appendChild(portal);
      window._assignSubjectPortal = portal;

      function refreshOptions() {
        options = (window._buildAssignSubjectOptions || buildOpts)();
      }

      function filtered() {
        refreshOptions();
        const q = (input.value || '').toLowerCase().trim();
        if (hidden.value) {
          const sel = options.find(o => o.value === hidden.value);
          if (sel && input.value === sel.label) return options.slice();
        }
        if (!q) return options.slice();
        return options.filter(o => (o.search || o.label.toLowerCase()).indexOf(q) !== -1);
      }

      function placePortal() {
        const rect = input.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const width = Math.min(Math.max(rect.width, 220), vw - 16);
        let left = rect.left;
        if (left + width > vw - 8) left = Math.max(8, vw - 8 - width);
        if (left < 8) left = 8;
        const spaceBelow = vh - rect.bottom - 8;
        const maxH = Math.min(280, Math.max(120, spaceBelow));
        portal.style.left = left + 'px';
        portal.style.top = (rect.bottom + 2) + 'px';
        portal.style.width = width + 'px';
        portal.style.maxHeight = maxH + 'px';
      }

      function renderPortal() {
        const items = filtered();
        highlight = -1;
        if (!items.length) {
          portal.innerHTML = '<li class="combo-empty">No matches</li>';
        } else {
          portal.innerHTML = items.map((o, i) => {
            const dis = o.disabled ? ' style="opacity:0.45;cursor:not-allowed;"' : '';
            const mark = (o.value === hidden.value) ? ' style="font-weight:700;"' : '';
            return '<li data-idx="' + i + '" data-value="' + escapeHtml(o.value) + '" data-disabled="' + (o.disabled ? '1' : '0') + '"' + dis + mark + '>' +
              escapeHtml(o.label) + '</li>';
          }).join('');
        }
        Array.from(portal.querySelectorAll('li[data-value]')).forEach(li => {
          li.onmousedown = function (ev) {
            ev.preventDefault();
            if (li.getAttribute('data-disabled') === '1') {
              if (typeof showToast === 'function') showToast('That subject is not available for this class');
              return;
            }
            const val = li.getAttribute('data-value');
            const opt = options.find(o => o.value === val);
            hidden.value = val;
            input.value = opt ? opt.label : '';
            closePortal();
            checkPotentialClash();
            checkQuotaWarning();
            checkSameDayWarning();
          };
        });
      }

      function openPortal() {
        open = true;
        placePortal();
        renderPortal();
        portal.style.display = 'block';
        toggle.textContent = '▲';
      }

      function closePortal() {
        open = false;
        portal.style.display = 'none';
        toggle.textContent = '▼';
        // Snap text to selected label
        const opt = options.find(o => o.value === hidden.value);
        if (opt) input.value = opt.label;
      }

      input.onfocus = function () { 
        openPortal(); 
        setTimeout(function(){ try{ input.select(); }catch(e){} }, 15);
      };
      input.onclick = function () {
        openPortal();
        setTimeout(function(){ try{ input.select(); }catch(e){} }, 15);
      };
      input.oninput = function () {
        hidden.value = '';
        openPortal();
      };
      input.onkeydown = function (ev) {
        const items = filtered().filter(o => !o.disabled);
        if (ev.key === 'ArrowDown') {
          ev.preventDefault();
          if (!open) openPortal();
          highlight = Math.min(highlight + 1, items.length - 1);
        } else if (ev.key === 'ArrowUp') {
          ev.preventDefault();
          highlight = Math.max(highlight - 1, 0);
        } else if (ev.key === 'Enter') {
          ev.preventDefault();
          if (open && highlight >= 0 && items[highlight]) {
            const opt = items[highlight];
            hidden.value = opt.value;
            input.value = opt.label;
            closePortal();
            checkPotentialClash();
            checkQuotaWarning();
            checkSameDayWarning();
          }
        } else if (ev.key === 'Escape') {
          closePortal();
        }
      };
      toggle.onclick = function (ev) {
        ev.preventDefault();
        if (open) closePortal();
        else { input.focus(); openPortal(); }
      };

      if (!window._assignSubjectOutsideBound) {
        window._assignSubjectOutsideBound = true;
        document.addEventListener('mousedown', function (ev) {
          if (!window._assignSubjectPortal || window._assignSubjectPortal.style.display === 'none') return;
          const boxEl = document.getElementById('assignSubjectCombo');
          if (boxEl && (boxEl.contains(ev.target) || window._assignSubjectPortal.contains(ev.target))) return;
          const inp = document.getElementById('assignSubjectInput');
          const hid = document.getElementById('assignSubject');
          if (inp && hid) {
            const opts = (window._buildAssignSubjectOptions || function () { return []; })();
            const opt = opts.find(o => o.value === hid.value);
            inp.value = opt ? opt.label : '';
          }
          window._assignSubjectPortal.style.display = 'none';
          const tog = document.getElementById('assignSubjectToggle');
          if (tog) tog.textContent = '▼';
        });
      }
    }

    function closeAssignModal() {
      window._lastClickedSubjectId = null;
      window._lastClickedClassId = null;

      window._forceAddActive = false;
      // reset add button text
      const _btns = document.querySelectorAll('#assignModal .btn-primary');
      _btns.forEach(b => { b.style.background = ''; b.textContent = '+ Add to this slot'; });

      document.getElementById('assignModal').classList.remove('open');
      state.currentSlot = null;
      if (window._assignClassPortal) {
        window._assignClassPortal.remove();
        window._assignClassPortal = null;
      }
      if (window._assignSubjectPortal) {
        window._assignSubjectPortal.remove();
        window._assignSubjectPortal = null;
      }
    }

    /** Clear subjects for the selected class in the current period (one cell). */
    function clearAssignCell() {
      if (!state.currentSlot) return;
      const { day, slotId } = state.currentSlot;
      const classId = document.getElementById('assignClass').value;
      if (!classId) {
        showToast('Select a class first');
        return;
      }
      const inCell = state.assignments.filter(a => a.day === day && a.slotId === slotId && a.classId === classId);
      if (!inCell.length) {
        showToast('This cell is already empty');
        return;
      }
      const lockedIn = inCell.filter(assignmentIsLocked);
      if (lockedIn.length && lockedIn.length === inCell.length) {
        showToast('All subjects in this cell are locked — unlock first');
        return;
      }
      if (lockedIn.length) {
        if (!confirm(lockedIn.length + ' locked subject(s) will be kept. Clear the rest?')) return;
      }
      const before = state.assignments.length;
      state.assignments = state.assignments.filter(a => {
        if (!(a.day === day && a.slotId === slotId && a.classId === classId)) return true;
        return assignmentIsLocked(a);
      });
      const removed = before - state.assignments.length;
      if (!removed) {
        showToast('This cell is already empty');
        return;
      }
      renderModalEntries();
      renderTable();
      renderSubjects();
      updateConflicts();
      if (window._fillSubjectOptions) window._fillSubjectOptions();
      checkPotentialClash();
      checkQuotaWarning();
      checkSameDayWarning();
      showToast('Cell cleared (' + removed + ' subject' + (removed > 1 ? 's' : '') + ' removed)');
      pushHistory();
    }

    /** Clear every teaching assignment on the school general timetable. */
    function clearTeachingTimetable() {
      if (!state.assignments.length) {
        showToast('Timetable is already empty');
        return;
      }
      const lockedN = state.assignments.filter(assignmentIsLocked).length;
      const msg = lockedN
        ? ('Clear all unlocked subjects from the school general timetable?\n\n' + lockedN + ' locked period(s) will be kept.\n\nThis does not remove classes, subjects, or Exam/CA sessions.')
        : 'Clear all subjects from the school general timetable?\n\nThis does not remove classes, subjects, or Exam/CA sessions.';
      if (!confirm(msg)) return;
      const before = state.assignments.length;
      state.assignments = state.assignments.filter(assignmentIsLocked);
      const n = before - state.assignments.length;
      renderTable();
      renderSubjects();
      updateConflicts();
      showToast('Cleared ' + n + ' assignment' + (n > 1 ? 's' : '') + (lockedN ? (', kept ' + lockedN + ' locked') : '') + ' from the timetable');
    }

    /**
     * Clear allotted subjects for a class on the school timetable.
     * Optional: only one subject if selected in the toolbar dropdowns.
     */
    function clearAllottedForClass() {
      const classSel = document.getElementById('clearClassSelect');
      const subjSel = document.getElementById('clearSubjectSelect');
      const classId = classSel ? classSel.value : '';
      const subjectId = subjSel ? subjSel.value : '';
      if (!classId) {
        showToast('Select a class to clear');
        return;
      }
      const cls = state.classes.find(c => c.id === classId);
      const className = cls ? cls.name : 'class';
      let toRemove;
      if (subjectId) {
        const subj = state.subjects.find(s => s.id === subjectId);
        const subjName = subj ? subj.name : 'subject';
        toRemove = state.assignments.filter(a => a.classId === classId && a.subjectId === subjectId && !assignmentIsLocked(a));
        if (!toRemove.length) {
          showToast(subjName + ' is not allotted for ' + className + ' (or all are locked)');
          return;
        }
        if (!confirm('Clear unlocked “' + subjName + '” periods for ' + className + '?\n\n' + toRemove.length + ' cell(s) will be emptied. Locked ones stay.')) return;
        const removeIds = {};
        toRemove.forEach(a => { removeIds[a.id] = true; });
        state.assignments = state.assignments.filter(a => !removeIds[a.id]);
        showToast('Cleared ' + toRemove.length + ' “' + subjName + '” period(s) for ' + className);
        pushHistory();
      } else {
        toRemove = state.assignments.filter(a => a.classId === classId && !assignmentIsLocked(a));
        if (!toRemove.length) {
          showToast(className + ' has no unlocked allotted subjects');
          return;
        }
        if (!confirm('Clear unlocked allotted subjects for ' + className + '?\n\n' + toRemove.length + ' period(s) will be emptied. Locked ones stay.')) return;
        state.assignments = state.assignments.filter(a => a.classId !== classId || assignmentIsLocked(a));
        showToast('Cleared ' + toRemove.length + ' period(s) for ' + className);
        pushHistory();
      }
      renderTable();
      renderSubjects();
      updateConflicts();
    }

    /** From assign modal: clear every allotted subject for the selected class. */
    function clearClassScheduleFromModal() {
      const classId = document.getElementById('assignClass').value;
      if (!classId) {
        showToast('Select a class first');
        return;
      }
      const cls = state.classes.find(c => c.id === classId);
      const className = cls ? cls.name : 'class';
      const toRemove = state.assignments.filter(a => a.classId === classId && !assignmentIsLocked(a));
      if (!toRemove.length) {
        showToast(className + ' has no unlocked allotted subjects');
        return;
      }
      if (!confirm('Clear unlocked allotted subjects for ' + className + ' across the week?\n\n' + toRemove.length + ' period(s) will be emptied. Locked ones stay.')) return;
      state.assignments = state.assignments.filter(a => a.classId !== classId || assignmentIsLocked(a));
      renderModalEntries();
      renderTable();
      renderSubjects();
      updateConflicts();
      if (window._fillSubjectOptions) window._fillSubjectOptions();
      checkPotentialClash();
      checkQuotaWarning();
      checkSameDayWarning();
      showToast('Cleared ' + toRemove.length + ' period(s) for ' + className);
      pushHistory();
    }

    function renderModalEntries() {
      const { day, slotId } = state.currentSlot;
      let entries = getAssignmentsForSlot(day, slotId);
      // If user clicked a specific subject on grid, show ONLY that subject in the Remove list (above click on grid)
      if (window._lastClickedSubjectId && window._lastClickedClassId) {
        const filtered = entries.filter(e => e.subjectId === window._lastClickedSubjectId && e.classId === window._lastClickedClassId);
        if (filtered.length > 0) {
          entries = filtered;
        }
      }
      // In teacher view, show only this teacher's assignments in the modal
      if (state.currentView === 'teacher' && state.selectedTeacher) {
        const t = state.selectedTeacher.toLowerCase();
        entries = entries.filter(e => {
          const subj = state.subjects.find(s => s.id === e.subjectId);
          return subj && (subj.teacher || '').trim().toLowerCase() === t;
        });
      }
      const clashes = getTeacherClashes();
      const container = document.getElementById('modalEntries');

      if (entries.length === 0) {
        container.innerHTML = '<p style="color:var(--muted);font-size:0.85rem;">No assignments in this slot yet.</p>';
        return;
      }

      // Add filtered info banner when showing only clicked subject
      let filteredBanner = '';
      if (window._lastClickedSubjectId && window._lastClickedClassId) {
        const fSubj = state.subjects.find(s => s.id === window._lastClickedSubjectId);
        const fCls = state.classes.find(c => c.id === window._lastClickedClassId);
        if (fSubj && fCls) {
          filteredBanner = '<div style="font-size:0.72rem;color:#3730a3;background:#eef2ff;border:1px solid #c7d2fe;padding:6px 10px;border-radius:6px;margin-bottom:8px;">🔍 Showing only <strong>' + escapeHtml(fSubj.name) + '</strong> for <strong>' + escapeHtml(fCls.name) + '</strong> — the subject you clicked on grid. <a href="#" onclick="event.preventDefault(); window._lastClickedSubjectId=null; window._lastClickedClassId=null; renderModalEntries(); updateTopSubjectPlacements();" style="color:#4f46e5;font-weight:700;margin-left:6px;">Show all in this slot</a></div>';
        }
      }


      // Count subjects per class in this slot for group labels
      const countByClass = {};
      const groupNameByClass = {};
      entries.forEach(e => {
        countByClass[e.classId] = (countByClass[e.classId] || 0) + 1;
        if (e.groupName) groupNameByClass[e.classId] = e.groupName;
      });

      // Rename controls for each class that has a concurrent group in this slot
      let groupEditors = '';
      Object.keys(countByClass).forEach(cid => {
        if (countByClass[cid] < 2) return;
        const cls = state.classes.find(c => c.id === cid);
        const gname = groupNameByClass[cid] || 'Group';
        groupEditors += '<div class="group-rename-row" style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding:8px 10px;background:#eff6ff;border:1px solid #93c5fd;border-radius:8px;">' +
          '<span style="font-size:0.78rem;font-weight:600;color:#1e40af;white-space:nowrap;">📁 ' + escapeHtml(cls ? cls.name : 'Class') + '</span>' +
          '<input type="text" id="groupName_' + cid + '" value="' + escapeHtml(gname) + '" placeholder="Group name" ' +
          'onkeydown="if(event.key===\'Enter\'){event.preventDefault();renameGroup(\'' + cid + '\');}" ' +
          'style="flex:1;padding:6px 8px;font-size:0.82rem;border:1px solid #93c5fd;border-radius:6px;background:white;" />' +
          '<button type="button" class="btn btn-primary btn-xs" onclick="renameGroup(\'' + cid + '\')">Rename</button></div>';
      });

      container.innerHTML = filteredBanner + groupEditors + entries.map(e => {
        const cls = state.classes.find(c => c.id === e.classId);
        const subj = state.subjects.find(s => s.id === e.subjectId);
        const inClash = isAssignmentInClash(e.id, clashes);
        const isGroup = (countByClass[e.classId] || 0) > 1;
        const gLabel = isGroup ? (e.groupName || groupNameByClass[e.classId] || 'Group') : '';
        const locked = assignmentIsLocked(e);
        return '<div class="modal-entry" style="' + (locked ? 'border-color:#f59e0b;background:#fffbeb;' : (inClash ? 'border-color:#f87171;background:#fef2f2;' : (isGroup ? 'border-color:#93c5fd;background:#eff6ff;' : ''))) + '" onclick="toggleSubjectPlacements(\'' + e.subjectId + '\', \'' + e.classId + '\', \'' + e.id + '\')">' +
          '<div class="color-dot" style="background:' + (subj?.color || '#999') + '"></div>' +
          '<div class="info"><strong>' + escapeHtml(cls?.name || '?') + '</strong> → ' + escapeHtml(subj?.name || '?') +
          (isGroup ? ' <span style="font-size:0.68rem;font-weight:700;color:#1d4ed8;">· ' + escapeHtml(gLabel) + '</span>' : '') +
          (locked ? ' <span style="font-size:0.68rem;font-weight:800;color:#b45309;">🔒 Locked</span>' : '') +
          '<div style="font-size:0.75rem;color:var(--muted);">' + escapeHtml(subj?.teacher || '') + (subj?.room ? ' · ' + escapeHtml(subj.room) : '') + '</div>' +
          (inClash ? '<div style="color:#dc2626;font-size:0.75rem;font-weight:600;">⚠️ Teacher clash</div>' : '') +
          '<div id="placement_' + e.id + '" class="subject-placements" style="margin-top:8px;"></div>' +
          '</div><div style="display:flex;flex-direction:column;gap:4px;">' +
          '<button type="button" class="btn btn-secondary btn-xs" onclick="event.stopPropagation(); toggleAssignmentLock(\'' + e.id + '\')" title="' + (locked ? 'Allow Clear Auto / regenerate to move this' : 'Protect from Clear Auto / regenerate') + '">' + (locked ? '🔓 Unlock' : '🔒 Lock') + '</button>' +
          '<button type="button" class="btn btn-danger btn-xs" onclick="event.stopPropagation(); removeAssignment(\'' + e.id + '\')">Remove</button></div></div>';
      }).join('');
    }

    function groupFoldKey(day, slotId, classId) {
      return String(day || '') + '|' + String(slotId || '') + '|' + String(classId || '');
    }

    function armFoldKey(day, slotId, subjectId) {
      return 'arm|' + String(day || '') + '|' + String(slotId || '') + '|' + String(subjectId || '');
    }

    /** Default: folded (single group name). */
    function isGroupFolded(day, slotId, classId) {
      if (!state.foldedGroups) state.foldedGroups = {};
      const key = groupFoldKey(day, slotId, classId);
      if (!(key in state.foldedGroups)) return true;
      return !!state.foldedGroups[key];
    }

    function isArmGroupFolded(day, slotId, subjectId) {
      if (!state.foldedGroups) state.foldedGroups = {};
      const key = armFoldKey(day, slotId, subjectId);
      if (!(key in state.foldedGroups)) return true;
      return !!state.foldedGroups[key];
    }

    function toggleGroupFold(day, slotId, classId, evt) {
      if (evt) {
        try { evt.stopPropagation(); evt.preventDefault(); } catch (e) {}
      }
      if (!day || !slotId || !classId) return;
      if (!state.foldedGroups) state.foldedGroups = {};
      const key = groupFoldKey(day, slotId, classId);
      state.foldedGroups[key] = !isGroupFolded(day, slotId, classId);
      try { localStorage.setItem('schoolMasterTimetable', JSON.stringify(state)); } catch (e) {}
      if (typeof renderTable === 'function') renderTable();
      if (typeof renderCompareLeft === 'function') {
        try { renderCompareLeft(); renderCompareRight(); } catch (e) {}
      }
    }

    function toggleArmGroupFold(day, slotId, subjectId, evt) {
      if (evt) {
        try { evt.stopPropagation(); evt.preventDefault(); } catch (e) {}
      }
      if (!day || !slotId || !subjectId) return;
      if (!state.foldedGroups) state.foldedGroups = {};
      const key = armFoldKey(day, slotId, subjectId);
      state.foldedGroups[key] = !isArmGroupFolded(day, slotId, subjectId);
      try { localStorage.setItem('schoolMasterTimetable', JSON.stringify(state)); } catch (e) {}
      if (typeof renderTable === 'function') renderTable();
      if (typeof renderCompareLeft === 'function') {
        try { renderCompareLeft(); renderCompareRight(); } catch (e) {}
      }
    }

    function renderSingleEntryHtml(e, day, slot, forceTeacherCtx, isGroup, groupLabel) {
      const subj = subjectById(e.subjectId) || state.subjects.find(s => s.id === e.subjectId);
      if (!subj) return '';
      const cls = classById(e.classId) || state.classes.find(c => c.id === e.classId);
      // Never recompute clashes per entry — use shared set from renderTable
      const inClash = typeof isAssignmentInClash === 'function' && isAssignmentInClash(e.id, null);
      const locked = typeof assignmentIsLocked === 'function' && assignmentIsLocked(e);
      const teacherCtx = !!forceTeacherCtx;
      return '<div ' + (locked ? 'draggable="false"' : 'draggable="true" ondragstart="handleEntryDragStart(event)" ondragend="handleEntryDragEnd(event)" ontouchstart="handleEntryTouchStart(event)"') +
        ' data-assign-id="' + e.id + '" data-day="' + escapeHtml(day) + '" data-slot-id="' + escapeHtml(slot.id) + '" data-class-id="' + escapeHtml(e.classId) + '" ' +
        'class="entry ' + (inClash ? 'clash ' : '') + (isGroup ? 'grouped ' : '') + (locked ? 'locked ' : '') + '" ' +
        'style="background:' + subj.color + ';' + (locked ? 'cursor:pointer;' : 'cursor:grab;') + '" ' +
        'onclick="event.stopPropagation(); openAssignModal(\'' + day + '\', \'' + slot.id + '\', \'' + e.classId + '\', ' + (teacherCtx ? 'true' : 'false') + ', \'' + e.subjectId + '\', \'' + e.classId + '\')" ' +
        'title="' + (locked ? '🔒 Locked' : 'Click to edit') + '">' +
        (locked ? '<div class="entry-lock">🔒</div>' : '') +
        (isGroup ? '<div class="entry-group-tag">' + escapeHtml(groupLabel || 'Group') + '</div>' : '') +
        (teacherCtx && cls ? '<div class="entry-class">' + escapeHtml(cls.name) + '</div>' : '') +
        '<div class="entry-subj">' + escapeHtml(subj.name) + '</div>' +
        (teacherCtx
          ? (subj.room ? '<div class="entry-room">' + escapeHtml(subj.room) + '</div>' : '')
          : ('<div class="entry-teacher">' + escapeHtml(subj.teacher || '') + (subj.room ? ' · ' + escapeHtml(subj.room) : '') + '</div>')) +
        '</div>';
    }

    /** Concurrent subjects for one class (folder by group name). */
    function renderClassConcurrentHtml(list, day, slot, forceTeacherCtx) {
      if (!list || !list.length) return '';
      const cid = list[0].classId;
      const isGroup = list.length > 1;
      const groupLabel = isGroup
        ? (list.map(x => x.groupName).find(Boolean) || 'Group')
        : '';
      let html = '';
      if (isGroup && isGroupFolded(day, slot.id, cid)) {
        const anyClash = list.some(e => typeof isAssignmentInClash === 'function' && isAssignmentInClash(e.id, null));
        const names = list.map(e => {
          const s = subjectById(e.subjectId) || state.subjects.find(x => x.id === e.subjectId);
          return s ? s.name : '?';
        }).join(', ');
        const assignIds = list.map(e => e.id).filter(Boolean).join(',');
        html += '<div class="entry grouped group-folded' + (anyClash ? ' clash' : '') + '" ' +
          'data-day="' + escapeHtml(day) + '" data-slot-id="' + escapeHtml(slot.id) + '" data-class-id="' + escapeHtml(cid) + '" ' +
          (assignIds ? 'data-assign-ids="' + escapeHtml(assignIds) + '" ' : '') +
          'draggable="true" ondragstart="handleEntryDragStart(event)" ondragend="handleEntryDragEnd(event)" ontouchstart="handleEntryTouchStart(event)" ' +
          'onclick="event.stopPropagation(); toggleGroupFold(\'' + escapeHtml(day) + '\',\'' + escapeHtml(slot.id) + '\',\'' + escapeHtml(cid) + '\', event)" ' +
          'title="Combined subjects — click to expand\n' + escapeHtml(names) + '">' +
          '<div class="entry-subj">📁 ' + escapeHtml(groupLabel) + '</div>' +
          '<div class="entry-teacher">' + list.length + ' subjects · tap to expand</div>' +
          '<button type="button" class="entry group-fold-btn" onclick="event.stopPropagation(); toggleGroupFold(\'' + escapeHtml(day) + '\',\'' + escapeHtml(slot.id) + '\',\'' + escapeHtml(cid) + '\', event)">▼ Expand</button>' +
          '</div>';
        return html;
      }
      if (isGroup) {
        html += '<div class="entry group-expanded-bar" onclick="event.stopPropagation(); toggleGroupFold(\'' + escapeHtml(day) + '\',\'' + escapeHtml(slot.id) + '\',\'' + escapeHtml(cid) + '\', event)" title="Fold into group name">' +
          '<span>📁 ' + escapeHtml(groupLabel) + ' · ' + list.length + ' subjects</span>' +
          '<span>▲ Fold</span></div>';
      }
      list.forEach(e => {
        html += renderSingleEntryHtml(e, day, slot, forceTeacherCtx, isGroup, groupLabel);
      });
      return html;
    }

    /**
     * Render entries in a cell.
     * - Combined arms (same subject, 2+ classes): fold → subject name + class arms
     * - Concurrent subjects (same class, 2+ subjects): fold → group name
     */
    function renderGroupedEntriesHtml(entries, day, slot, forceTeacherCtx) {
      if (!entries || !entries.length) return '';
      let html = '';

      // 1) Combined class arms: same subject across 2+ classes in this cell
      const bySubject = {};
      entries.forEach(e => {
        const sid = e.subjectId || '_';
        if (!bySubject[sid]) bySubject[sid] = [];
        bySubject[sid].push(e);
      });
      const armSubjectIds = {};
      const remaining = [];
      Object.keys(bySubject).forEach(sid => {
        const list = bySubject[sid];
        const classIds = [];
        list.forEach(e => {
          if (e.classId && classIds.indexOf(e.classId) < 0) classIds.push(e.classId);
        });
        if (classIds.length >= 2) {
          armSubjectIds[sid] = true;
          const subj = subjectById(sid) || state.subjects.find(s => s.id === sid);
          const subjName = subj ? subj.name : 'Subject';
          const armNames = classIds.map(cid => {
            const c = classById(cid) || state.classes.find(x => x.id === cid);
            return c ? c.name : '?';
          });
          const armsLabel = armNames.join(' + ');
          const assignIds = list.map(e => e.id).filter(Boolean).join(',');
          const anyClash = list.some(e => typeof isAssignmentInClash === 'function' && isAssignmentInClash(e.id, null));
          const bg = subj && subj.color ? subj.color : '#0d9488';

          if (isArmGroupFolded(day, slot.id, sid)) {
            html += '<div class="entry grouped group-folded arm-folded' + (anyClash ? ' clash' : '') + '" ' +
              'data-day="' + escapeHtml(day) + '" data-slot-id="' + escapeHtml(slot.id) + '" data-subject-id="' + escapeHtml(sid) + '" ' +
              (assignIds ? 'data-assign-ids="' + escapeHtml(assignIds) + '" ' : '') +
              'draggable="true" ondragstart="handleEntryDragStart(event)" ondragend="handleEntryDragEnd(event)" ontouchstart="handleEntryTouchStart(event)" ' +
              'style="background:' + bg + ';" ' +
              'onclick="event.stopPropagation(); toggleArmGroupFold(\'' + escapeHtml(day) + '\',\'' + escapeHtml(slot.id) + '\',\'' + escapeHtml(sid) + '\', event)" ' +
              'title="Combined arms — click to expand\n' + escapeHtml(subjName) + ' · ' + escapeHtml(armsLabel) + '">' +
              '<div class="entry-subj">' + escapeHtml(subjName) + '</div>' +
              '<div class="entry-arms">' + escapeHtml(armsLabel) + '</div>' +
              '<div class="entry-teacher">' + classIds.length + ' arms · tap to expand</div>' +
              '<button type="button" class="entry group-fold-btn" onclick="event.stopPropagation(); toggleArmGroupFold(\'' + escapeHtml(day) + '\',\'' + escapeHtml(slot.id) + '\',\'' + escapeHtml(sid) + '\', event)">▼ Expand</button>' +
              '</div>';
          } else {
            html += '<div class="entry group-expanded-bar" style="color:#0f766e;background:rgba(13,148,136,0.12);" onclick="event.stopPropagation(); toggleArmGroupFold(\'' + escapeHtml(day) + '\',\'' + escapeHtml(slot.id) + '\',\'' + escapeHtml(sid) + '\', event)" title="Fold combined arms">' +
              '<span>' + escapeHtml(subjName) + ' · ' + escapeHtml(armsLabel) + '</span>' +
              '<span>▲ Fold</span></div>';
            list.forEach(e => {
              html += renderSingleEntryHtml(e, day, slot, forceTeacherCtx, false, '');
            });
          }
        } else {
          list.forEach(e => remaining.push(e));
        }
      });

      // 2) Remaining: concurrent subjects per class (or singles)
      const byClass = {};
      remaining.forEach(e => {
        const cid = e.classId || '_';
        if (!byClass[cid]) byClass[cid] = [];
        byClass[cid].push(e);
      });
      Object.keys(byClass).forEach(cid => {
        html += renderClassConcurrentHtml(byClass[cid], day, slot, forceTeacherCtx);
      });

      return html;
    }

    function renameGroup(classId) {
      if (!state.currentSlot || !classId) return;
      const input = document.getElementById('groupName_' + classId);
      if (!input) return;
      const name = (input.value || '').trim() || 'Group';
      const { day, slotId } = state.currentSlot;
      let updated = 0;
      state.assignments.forEach(a => {
        if (a.day === day && a.slotId === slotId && a.classId === classId) {
          a.grouped = true;
          a.groupName = name;
          updated++;
        }
      });
      if (updated < 2) {
        showToast('Need at least 2 subjects in this period to name a group');
        return;
      }
      renderModalEntries();
      renderTable();
      showToast('Group renamed to “' + name + '”');
    }

    

    // --- FORCE ADD override ---
    window._forceAddActive = false;
    function setForceAdd(shouldForce) {
      window._forceAddActive = !!shouldForce;
      // Update UI and button
      const addBtns = document.querySelectorAll('#assignModal .btn-primary');
      if (shouldForce) {
        addBtns.forEach(b => {
          if (b.textContent.indexOf('Add') !== -1 || b.getAttribute('onclick') === 'addAssignment()') {
            b.disabled = false;
            b.style.opacity = '1';
            b.style.cursor = 'pointer';
            b.style.background = 'linear-gradient(180deg, #16a34a 0%, #15803d 100%)';
            b.textContent = '⚠️ Force Add to this slot';
          }
        });
      } else {
        // Reset button text and re-evaluate warnings
        addBtns.forEach(b => {
          if (b.textContent.indexOf('Add') !== -1 || b.textContent.indexOf('Force') !== -1) {
            b.style.background = '';
            b.textContent = '+ Add to this slot';
          }
        });
        checkSameDayWarning();
        checkQuotaWarning();
        return;
      }
      // Refresh warning boxes to show active state
      const sd = document.getElementById('sameDayWarning');
      const q = document.getElementById('quotaWarning');
      if (sd && sd.style.display !== 'none') checkSameDayWarning();
      if (q && q.style.display !== 'none') checkQuotaWarning();
    }

    function buildForceAddUI() {
      const yesActive = window._forceAddActive ? ' active' : '';
      const noActive = !window._forceAddActive ? ' active' : '';
      return '<div class="force-add-box">' +
        '<span class="force-q">Should I force it?</span>' +
        '<button type="button" class="force-btn no' + noActive + '" onclick="setForceAdd(false)">No</button>' +
        '<button type="button" class="force-btn yes' + yesActive + '" onclick="setForceAdd(true)">Yes — Force add</button>' +
        '</div>';
    }

        function checkSameDayWarning() {
      let el = document.getElementById('sameDayWarning');
      if (!el) {
        const clash = document.getElementById('clashWarning');
        if (!clash || !clash.parentNode) return;
        el = document.createElement('div');
        el.id = 'sameDayWarning';
        el.style.cssText = 'display:none;background:#fef2f2;color:#991b1b;padding:8px 12px;border-radius:8px;font-size:0.82rem;margin-bottom:10px;';
        clash.parentNode.insertBefore(el, clash);
      }
      const classId = document.getElementById('assignClass').value;
      const subjectId = document.getElementById('assignSubject').value;
      if (!classId || !subjectId || !state.currentSlot) {
        el.style.display = 'none';
        return;
      }
      const { day, slotId } = state.currentSlot;
      const rule = checkSameDaySubjectRule(subjectId, classId, day, slotId);
      if (!rule.ok) {
        el.style.display = 'block';
        el.innerHTML = rule.message + buildForceAddUI();
        if (window._forceAddActive) {
          setAddButtonEnabled(true);
        } else {
          setAddButtonEnabled(false);
        }
      } else {
        el.style.display = 'none';
        checkQuotaWarning();
      }
    }


    
    function navigateToPlacement(day, slotId, classId) {
      if (typeof closeAssignModal === 'function') closeAssignModal();
      setTimeout(() => {
        let sel = 'td.slot[data-day="' + CSS.escape(day) + '"][data-slot-id="' + CSS.escape(slotId) + '"]';
        if (classId) sel += '[data-class-id="' + CSS.escape(classId) + '"]';
        let cells = Array.from(document.querySelectorAll(sel));
        if (!cells.length) {
          cells = Array.from(document.querySelectorAll(
            'td.slot[data-day="' + CSS.escape(day) + '"][data-slot-id="' + CSS.escape(slotId) + '"]'
          ));
        }
        if (cells.length) {
          cells[0].scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
          cells.forEach(cell => {
            cell.classList.add('jump-highlight');
            setTimeout(() => cell.classList.remove('jump-highlight'), 3000);
          });
          const slot = state.slots.find(s => s.id === slotId) || (state.examSlots || []).find(s => s.id === slotId);
          showToast('📍 Jumped to ' + day + ' · ' + (slot ? slot.label : slotId));
        } else {
          showToast('Cell not visible in this view — try School General');
        }
      }, 180);
    }

    /**
     * Jump from clashes panel to the conflicting cell(s) on the grid.
     * Switches to School General (or Exam) so the clash is visible, then highlights.
     */
    function jumpToClash(day, slotId, classId) {
      if (!day || !slotId) return;
      const isExam = state.currentView === 'exam' ||
        ((state.examSlots || []).some(s => s.id === slotId) && !(state.slots || []).some(s => s.id === slotId));
      const targetView = isExam ? 'exam' : 'school';
      const needSwitch = state.currentView !== targetView &&
        !(state.currentView === 'compare' && targetView === 'school');
      if (needSwitch && targetView !== PAGE_VIEW) {
        /* PAGES: the clash lives on another page - go there and highlight on arrival */
        try { sessionStorage.setItem('akeemPendingJump', JSON.stringify({ day: day, slotId: slotId, classId: classId || null })); } catch (e) {}
        goToPage(targetView);
        return;
      }
      if (needSwitch && typeof switchView === 'function') {
        switchView(targetView);
      }
      // Expand conflicts card so user still sees the list
      const card = document.getElementById('conflictsCard');
      if (card && card.classList.contains('collapsed') && typeof setSidebarCardCollapsed === 'function') {
        setSidebarCardCollapsed('conflictsCard', false);
      }
      navigateToPlacement(day, slotId, classId || null);
    }

    function updateTopSubjectPlacements() {
      const el = document.getElementById('topSubjectPlacements');
      if (!el) return;
      let focusedSubjId = window._lastClickedSubjectId || null;
      let focusedClassId = window._lastClickedClassId || null;
      const classIdDropdown = (document.getElementById('assignClass') || {}).value || '';
      const subjectIdDropdown = (document.getElementById('assignSubject') || {}).value || '';
      let subjectsToShow = [];
      if (focusedSubjId && focusedClassId) {
        subjectsToShow = [{ classId: focusedClassId, subjectId: focusedSubjId, id: 'clicked' }];
      } else if (classIdDropdown && subjectIdDropdown) {
        subjectsToShow = [{ classId: classIdDropdown, subjectId: subjectIdDropdown, id: 'dropdown' }];
      } else if (state.currentSlot) {
        const slotAssignments = getAssignmentsForSlot(state.currentSlot.day, state.currentSlot.slotId);
        if (slotAssignments.length > 0) {
          subjectsToShow = [{ classId: slotAssignments[0].classId, subjectId: slotAssignments[0].subjectId, id: 'cell' }];
        } else { el.style.display='none'; el.innerHTML=''; return; }
      } else { el.style.display='none'; el.innerHTML=''; return; }
      const dayOrder = {}; state.days.forEach((d,i)=>dayOrder[d]=i);
      let html = '';
      subjectsToShow.forEach((target) => {
        const cls = state.classes.find(c=>c.id===target.classId);
        const subj = state.subjects.find(s=>s.id===target.subjectId);
        if (!cls||!subj) return;
        const quota = getQuotaFor(target.subjectId, target.classId);
        const all = state.assignments.filter(a=>a.classId===target.classId && a.subjectId===target.subjectId);
        const sorted = all.slice().sort((a,b)=>{
          const da=dayOrder[a.day]??99; const db=dayOrder[b.day]??99;
          if(da!==db) return da-db;
          const ia=typeof slotIndex==='function'?slotIndex(a.slotId):0;
          const ib=typeof slotIndex==='function'?slotIndex(b.slotId):0;
          return ia-ib;
        });
        const titlePrefix = target.id==='clicked' ? '📌 Clicked on grid:' : (target.id==='dropdown' ? '📍 Selected:' : '📌 In this slot:');
        html+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">';
        html+='<span class="sp-head" style="margin:0;">'+titlePrefix+' '+escapeHtml(subj.name)+' for '+escapeHtml(cls.name)+' — '+all.length+'/'+(quota||all.length)+' placed</span>';
        if(quota>0 && all.length>=quota) html+='<span style="font-size:0.7rem;background:#16a34a;color:white;padding:2px 8px;border-radius:999px;font-weight:700;">✔ Complete</span>';
        else if(quota>0) html+='<span style="font-size:0.7rem;background:#f59e0b;color:white;padding:2px 8px;border-radius:999px;font-weight:700;">'+(quota-all.length)+' left</span>';
        html+='</div>';
        if(sorted.length===0) html+='<div style="color:#64748b;font-style:italic;">No periods placed yet.</div>';
        else {
          html+='<ul style="margin:0 0 8px 16px;padding:0;">';
          sorted.forEach(a=>{
            const sl=state.slots.find(s=>s.id===a.slotId);
            const label=sl?sl.label:a.slotId;
            const time=sl&&sl.start?' <span style="color:#64748b;">('+escapeHtml(sl.start+'–'+sl.end)+')</span>':'';
            const isCurrent=state.currentSlot && a.day===state.currentSlot.day && a.slotId===state.currentSlot.slotId;
            const curMark=isCurrent?' <span style="background:#4f46e5;color:white;padding:1px 6px;border-radius:4px;font-size:0.68rem;margin-left:4px;">THIS SLOT</span>':'';
            const canJump = !isCurrent;
            const jumpClick = canJump ? ' onclick="navigateToPlacement(\''+escapeHtml(a.day)+'\', \''+a.slotId+'\', \''+a.classId+'\')" style="'+(isCurrent?'background:#e0e7ff;padding:2px 6px;border-radius:4px;font-weight:700;cursor:default;':'cursor:pointer;')+'" title="Click to jump to this period"' : ' style="'+(isCurrent?'background:#e0e7ff;padding:2px 6px;border-radius:4px;font-weight:700;':'')+'"';
            html+='<li'+jumpClick+'>📅 <strong>'+escapeHtml(a.day)+'</strong> · <strong>'+escapeHtml(label)+'</strong>'+time+curMark+(canJump?' <span style="color:#4f46e5;font-size:0.65rem;margin-left:6px;">↗️ Go</span>':'')+'</li>';
          });
          html+='</ul>';
        }
      });
      el.innerHTML=html; el.style.display='block'; el.classList.add('open');
    }


    function toggleSubjectPlacements(subjectId, classId, currentId) {
      const box = document.getElementById('placement_' + currentId);
      if (!box) return;
      if (box.classList.contains('open')) { box.classList.remove('open'); box.innerHTML = ''; return; }
      document.querySelectorAll('.subject-placements.open').forEach(el => {
        if (el.id !== 'topSubjectPlacements') { el.classList.remove('open'); el.innerHTML = ''; }
      });
      const cls = state.classes.find(c => c.id === classId);
      const subj = state.subjects.find(s => s.id === subjectId);
      if (!cls || !subj) return;
      const all = state.assignments.filter(a => a.classId === classId && a.subjectId === subjectId);
      const quota = getQuotaFor(subjectId, classId);
      const dayOrder = {};
      state.days.forEach((d,i) => dayOrder[d] = i);
      all.sort((a,b) => {
        const da = dayOrder[a.day] ?? 99;
        const db = dayOrder[b.day] ?? 99;
        if (da !== db) return da - db;
        const ia = typeof slotIndex === 'function' ? slotIndex(a.slotId) : 0;
        const ib = typeof slotIndex === 'function' ? slotIndex(b.slotId) : 0;
        return ia - ib;
      });
      const others = all.filter(a => a.id !== currentId);
      const current = all.find(a => a.id === currentId);
      let html = '<div class="sp-head">📌 ' + escapeHtml(subj.name) + ' for ' + escapeHtml(cls.name) + ' — ' + all.length + '/' + (quota || all.length) + '</div>';
      if (current) {
        const sl = state.slots.find(s => s.id === current.slotId);
        html += '<div style="margin-bottom:6px;">Current: <span class="current">📍 ' + escapeHtml(current.day) + ' · ' + escapeHtml(sl ? sl.label : current.slotId) + '</span></div>';
      }
      if (others.length === 0) {
        html += '<div style="color:#64748b;font-style:italic;">No other periods placed yet.</div>';
      } else {
        html += '<div style="margin-bottom:4px;font-weight:600;">Other ' + others.length + ' period(s):</div><ul>';
        others.forEach(a => {
          const sl = state.slots.find(s => s.id === a.slotId);
          html += '<li>📅 <strong>' + escapeHtml(a.day) + '</strong> · ' + escapeHtml(sl ? sl.label : a.slotId) + '</li>';
        });
        html += '</ul>';
      }
      box.innerHTML = html;
      box.classList.add('open');
    }

    function setAddButtonEnabled(enabled) {
      const btns = document.querySelectorAll('#assignModal .btn-primary');
      btns.forEach(b => {
        if (b.textContent.indexOf('Add') !== -1 || b.getAttribute('onclick') === 'addAssignment()') {
          b.disabled = !enabled;
          b.style.opacity = enabled ? '1' : '0.5';
          b.style.cursor = enabled ? 'pointer' : 'not-allowed';
        }
      });
    }

        function checkQuotaWarning() {
      let el = document.getElementById('quotaWarning');
      if (!el) {
        const clash = document.getElementById('clashWarning');
        if (!clash) return;
        el = document.createElement('div');
        el.id = 'quotaWarning';
        el.style.cssText = 'display:none;background:#fef2f2;color:#991b1b;padding:8px 12px;border-radius:8px;font-size:0.82rem;margin-bottom:10px;';
        clash.parentNode.insertBefore(el, clash.nextSibling);
      }
      const classId = document.getElementById('assignClass').value;
      const subjectId = document.getElementById('assignSubject').value;
      if (!classId || !subjectId || !state.currentSlot) {
        el.style.display = 'none';
        if (!document.getElementById('sameDayWarning') || document.getElementById('sameDayWarning').style.display === 'none') {
          setAddButtonEnabled(true);
        }
        return;
      }
      const quota = getQuotaFor(subjectId, classId);
      const count = countSubjectForClass(subjectId, classId);
      const subj = state.subjects.find(s => s.id === subjectId);
      const cls = state.classes.find(c => c.id === classId);
      const { day, slotId } = state.currentSlot;
      const isSameSubjectHere = state.assignments.some(a =>
        a.day === day && a.slotId === slotId && a.classId === classId && a.subjectId === subjectId
      );
      const concurrentCount = state.assignments.filter(a =>
        a.day === day && a.slotId === slotId && a.classId === classId
      ).length;

      if (isSameSubjectHere) {
        el.style.display = 'block';
        el.style.background = '#fef3c7';
        el.style.color = '#92400e';
        el.innerHTML = 'ℹ️ This subject is already in this period for ' + escapeHtml(cls ? cls.name : 'class') + '. Choose another subject to group concurrently.';
        setAddButtonEnabled(false);
        return;
      }

      if (subj) {
        const dual = findOtherTeacherForSubjectInClass(subj.name, subj.teacher, classId, subjectId);
        if (dual) {
          el.style.display = 'block';
          el.style.background = '#fef2f2';
          el.style.color = '#991b1b';
          el.innerHTML = formatTeacherSubjectConflict({ className: cls ? cls.name : 'class', otherTeacher: dual.subject.teacher || '?' }, subj.name) + buildForceAddUI();
          if (window._forceAddActive) setAddButtonEnabled(true); else setAddButtonEnabled(false);
          return;
        }
      }

      if (quota === 0 && !isSameSubjectHere) {
        el.style.display = 'block';
        el.style.background = '#fef2f2';
        el.style.color = '#991b1b';
        el.innerHTML = '🚫 <strong>' + escapeHtml(subj ? subj.name : 'Subject') + '</strong> is set to <strong>0×/week</strong> for ' + escapeHtml(cls ? cls.name : 'class') + '. Edit the subject to allow periods.' + buildForceAddUI();
        if (window._forceAddActive) setAddButtonEnabled(true); else setAddButtonEnabled(false);
        return;
      }
      if (count >= quota && quota > 0 && !isSameSubjectHere) {
        el.style.display = 'block';
        el.style.background = '#fef2f2';
        el.style.color = '#991b1b';
        el.innerHTML = '🚫 Weekly limit reached: <strong>' + escapeHtml(subj ? subj.name : 'Subject') + '</strong> for <strong>' + escapeHtml(cls ? cls.name : 'class') + '</strong> is already <strong>' + count + '/' + quota + '</strong>. Remove an existing period first or increase the weekly limit.' + buildForceAddUI();
        if (window._forceAddActive) setAddButtonEnabled(true); else setAddButtonEnabled(false);
        return;
      }
      if (!window._forceAddActive) setAddButtonEnabled(true);
      if (count >= quota - 1 && count < quota && quota > 0 && !isSameSubjectHere) {
        el.style.display = 'block';
        el.style.background = '#fef3c7';
        el.style.color = '#92400e';
        el.innerHTML = 'ℹ️ <strong>' + escapeHtml(subj ? subj.name : 'Subject') + '</strong> for <strong>' + escapeHtml(cls ? cls.name : 'class') + '</strong>: ' + count + '/' + quota + ' — one slot left this week.' + (concurrentCount > 0 ? ' <em>Adding will group with ' + concurrentCount + ' other subject(s) in this period.</em>' : '');
        return;
      }
      if (quota > 0) {
        el.style.display = 'block';
        el.style.background = '#f0fdf4';
        el.style.color = '#166534';
        el.innerHTML = '✅ <strong>' + escapeHtml(subj ? subj.name : 'Subject') + '</strong> for <strong>' + escapeHtml(cls ? cls.name : 'class') + '</strong>: ' + count + '/' + quota + ' periods this week.' + (concurrentCount > 0 ? ' <em>Will group with ' + concurrentCount + ' subject(s) already in this period.</em>' : '');
      } else {
        el.style.display = 'none';
      }
    }

    function checkPotentialClash() {
      const warning = document.getElementById('clashWarning');
      const classId = document.getElementById('assignClass').value;
      const subjectId = document.getElementById('assignSubject').value;
      if (!classId || !subjectId || !state.currentSlot) { warning.style.display = 'none'; return; }

      const subj = state.subjects.find(s => s.id === subjectId);
      if (!subj || !subj.teacher) { warning.style.display = 'none'; return; }

      const { day, slotId } = state.currentSlot;
      const teacher = subj.teacher.toLowerCase().trim();

      const existing = state.assignments.filter(a => {
        if (a.day !== day || a.slotId !== slotId) return false;
        if (a.classId === classId) return false;
        const s = state.subjects.find(x => x.id === a.subjectId);
        if (!s || s.teacher.toLowerCase().trim() !== teacher) return false;
        // Combined arms of the same class + same subject = not a clash
        if (isCombinedArmAssignment(a, s, classId, subj)) return false;
        return true;
      });

      if (existing.length > 0) {
        const otherClasses = existing.map(a => {
          const c = state.classes.find(x => x.id === a.classId);
          return c ? c.name : '?';
        }).join(', ');
        const alts = findFreeAlternatives(classId, subjectId, day, slotId, 6);
        let altHtml = '';
        if (alts.length) {
          altHtml = '<div style="margin-top:6px;font-size:0.78rem;"><strong>Suggested free cells:</strong><ul style="margin:4px 0 0 16px;padding:0;">' +
            alts.map(a => '<li>' + escapeHtml(a.day) + ' · ' + escapeHtml(a.slotLabel) +
              (a.time ? ' <span style="opacity:0.8;">(' + escapeHtml(a.time) + ')</span>' : '') + '</li>').join('') +
            '</ul></div>';
        } else {
          altHtml = '<div style="margin-top:6px;font-size:0.78rem;">No free cell found for this class & teacher this week.</div>';
        }
        warning.style.display = 'block';
        warning.innerHTML = '⚠️ <strong>' + escapeHtml(subj.teacher) + '</strong> is already teaching <strong>' + escapeHtml(otherClasses) + '</strong> in this period. Adding this will create a clash.' + altHtml;
      } else {
        // Info when combined arms share the period
        const combined = state.assignments.filter(a => {
          if (a.day !== day || a.slotId !== slotId || a.classId === classId) return false;
          const s = state.subjects.find(x => x.id === a.subjectId);
          return s && s.teacher.toLowerCase().trim() === teacher && isCombinedArmAssignment(a, s, classId, subj);
        });
        if (combined.length) {
          const names = combined.map(a => {
            const c = state.classes.find(x => x.id === a.classId);
            return c ? c.name : '?';
          }).join(', ');
          warning.style.display = 'block';
          warning.style.background = '#ecfdf5';
          warning.style.color = '#065f46';
          warning.innerHTML = '✅ Combined arms: <strong>' + escapeHtml(subj.teacher) + '</strong> already has this subject with <strong>' + escapeHtml(names) + '</strong> — not counted as a clash.';
        } else {
          warning.style.display = 'none';
          warning.style.background = '';
          warning.style.color = '';
        }
      }
    }

    function ensureAssignmentIds() {
      let fixed = 0;
      (state.assignments || []).forEach(a => {
        if (a && !a.id) {
          a.id = 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
          fixed++;
        }
      });
      return fixed;
    }

    function clearMoveHints() {
      document.querySelectorAll('td.slot.move-hint-source, td.slot.move-hint-target').forEach(el => {
        el.classList.remove('move-hint-source', 'move-hint-target');
        el.removeAttribute('data-move-target');
        if (el.getAttribute('title') === 'Click to move subject here (free, no clash)') {
          el.title = 'Click to add or edit · right-click for free move slots';
        }
      });
      const tip = document.getElementById('moveHintTip');
      if (tip) {
        tip.classList.remove('show');
        tip.innerHTML = '';
        tip.setAttribute('aria-hidden', 'true');
      }
    }

    function showMoveHintTip(html, clientX, clientY) {
      const tip = document.getElementById('moveHintTip');
      if (!tip) return;
      tip.innerHTML = html;
      tip.classList.add('show');
      tip.setAttribute('aria-hidden', 'false');
      const pad = 12;
      tip.style.left = '0px';
      tip.style.top = '0px';
      void tip.offsetWidth;
      const rect = tip.getBoundingClientRect();
      let left = (clientX || 0) + pad;
      let top = (clientY || 0) + pad;
      if (left + rect.width > window.innerWidth - 8) left = (clientX || 0) - rect.width - pad;
      if (top + rect.height > window.innerHeight - 8) top = (clientY || 0) - rect.height - pad;
      if (left < 8) left = 8;
      if (top < 8) top = 8;
      tip.style.left = left + 'px';
      tip.style.top = top + 'px';
    }

    /** Resolve assignments for a timetable cell (ids attr or day/slot/class). */
    function getAssignmentsFromCellEl(cell) {
      if (!cell) return [];
      ensureAssignmentIds();
      const raw = (cell.getAttribute('data-assign-ids') || '').split(',').map(s => s.trim()).filter(Boolean);
      if (raw.length) {
        const found = raw.map(id => state.assignments.find(a => a.id === id)).filter(Boolean);
        if (found.length) return found;
      }
      const day = cell.getAttribute('data-day');
      const slotId = cell.getAttribute('data-slot-id');
      if (!day || !slotId) return [];
      const classId = cell.getAttribute('data-class-id') || '';
      let list = state.assignments.filter(a => a.day === day && a.slotId === slotId);
      if (classId) list = list.filter(a => a.classId === classId);
      // Teacher view: no class-id on cell — keep all matching day/slot that appear in this cell's entries
      return list;
    }


    // === COPY / PASTE CLIPBOARD (works exactly like drag-drop) ===
    window._timetableClipboard = null;
    window._pasteTargetCell = null;

    function setTimetableClipboard(assignIds, action){
      if (!assignIds || !assignIds.length) return;
      const assigns = assignIds.map(id=>state.assignments.find(a=>a.id===id)).filter(Boolean);
      if (!assigns.length) return;
      const labels = assigns.map(a=>{
        const subj = state.subjects.find(s=>s.id===a.subjectId);
        const cls = state.classes.find(c=>c.id===a.classId);
        return (cls?cls.name+':':'') + (subj?subj.name:'');
      });
      window._timetableClipboard = { assignIds: assignIds.slice(), action: action, labels: labels, count: assigns.length };
      showToast((action==='cut'?'✂️ Cut':'📋 Copied')+' '+assigns.length+' subject(s): '+labels.slice(0,2).join(', ')+(labels.length>2?'…':'')+' — right-click target cell to paste');
      clearMoveHints();
      window._moveHintSource=null;
    }
    function handleCopyFromHint(action){
      if (!window._moveHintSource || !window._moveHintSource.assignmentIds) return;
      setTimetableClipboard(window._moveHintSource.assignmentIds, action);
    }
    function pasteClipboardToCell(targetCell){
      if (!window._timetableClipboard || !targetCell) return;
      const tgt = getSlotTargetInfo(targetCell);
      if (!tgt) { showToast('Cannot paste here (break/JUMAT)'); return; }
      window._draggedData = {
        assignIds: window._timetableClipboard.assignIds.slice(),
        day: null, slotId: null, classId: null,
        clipboardAction: window._timetableClipboard.action
      };
      window._dropTarget = tgt;
      openDragActionModalForPaste();
    }
    function openDragActionModalForPaste(){
      const src = window._draggedData;
      const tgt = window._dropTarget;
      if (!src || !tgt) return;
      const clip = window._timetableClipboard;
      const defAct = clip ? clip.action : 'copy';
      const count = src.assignIds.length;
      const srcSubjs = src.assignIds.map(id=>{
        const a = state.assignments.find(x=>x.id===id);
        if (!a) return '?';
        const subj = state.subjects.find(s=>s.id===a.subjectId);
        const cls = state.classes.find(c=>c.id===a.classId);
        return (cls?cls.name+': ':'')+(subj?subj.name:'subject');
      }).join(', ');
      const tgtSlot = state.slots.find(s=>s.id===tgt.slotId);
      const tgtClassName = tgt.classId ? (state.classes.find(c=>c.id===tgt.classId)?.name || tgt.classId) : (state.currentView==='teacher' ? 'same class' : '—');
      const infoEl = document.getElementById('dragActionInfo');
      if (infoEl) {
        const clipLabel = defAct==='cut' ? '✂️ CUT → PASTE (Move)' : '📋 COPY → PASTE (Copy)';
        infoEl.innerHTML = '<div style="font-weight:700;color:#4f46e5;margin-bottom:6px;">'+clipLabel+'</div>' +
          '<strong>'+count+' subject'+(count>1?'s':'')+':</strong> '+escapeHtml(srcSubjs.substring(0,120))+(srcSubjs.length>120?'…':'')+'<br>' +
          '<span style="color:#0f172a;">To <b>'+escapeHtml(tgt.day)+' · '+escapeHtml(tgtSlot?tgtSlot.label:tgt.slotId)+' · '+escapeHtml(tgtClassName)+'</b></span>' +
          '<div style="margin-top:8px;font-size:0.72rem;color:#64748b;">Teacher auto-correct & quota check same as drag & drop</div>';
      }
      const btnMove = document.getElementById('btnDragMove');
      const btnCopy = document.getElementById('btnDragCopy');
      if (btnMove && btnCopy) {
        if (defAct==='cut') { btnMove.style.boxShadow='0 0 0 2px #4f46e5'; btnCopy.style.boxShadow=''; }
        else { btnCopy.style.boxShadow='0 0 0 2px #4f46e5'; btnMove.style.boxShadow=''; }
      }
      const modal = document.getElementById('dragActionModal');
      if (modal) modal.classList.add('open');
      clearMoveHints();
      window._moveHintSource=null;
    }
    function showPasteTipForCell(cell, clientX, clientY){
      if (!window._timetableClipboard) return;
      const tgt = getSlotTargetInfo(cell);
      if (!tgt) return;
      const clip = window._timetableClipboard;
      const label = clip.labels.slice(0,3).join(', ')+(clip.labels.length>3?'…':'');
      let tipHtml = '<strong>📋 Paste '+clip.count+' subject(s)</strong>';
      tipHtml += '<div style="font-size:0.72rem;color:#cbd5e1;margin-top:4px;">'+escapeHtml(label)+' ('+(clip.action==='cut'?'Cut':'Copy')+')</div>';
      tipHtml += '<div style="font-size:0.68rem;color:#94a3b8;margin-top:6px;">Target: '+escapeHtml(tgt.day)+' · '+escapeHtml((state.slots.find(s=>s.id===tgt.slotId)||{}).label||tgt.slotId)+'</div>';
      tipHtml += '<div style="display:flex;gap:6px;margin-top:10px;">';
      tipHtml += '<button type="button" onclick="window.pasteClipboardToCell(window._pasteTargetCell); event.stopPropagation();" style="background:#4f46e5;color:white;border:none;padding:6px 12px;border-radius:6px;font-weight:700;cursor:pointer;font-size:0.78rem;">📋 Paste here</button>';
      tipHtml += '<button type="button" onclick="window._timetableClipboard=null; clearMoveHints(); showToast(\'Clipboard cleared\'); event.stopPropagation();" style="background:#334155;color:white;border:none;padding:6px 10px;border-radius:6px;cursor:pointer;font-size:0.72rem;">Clear</button>';
      tipHtml += '</div>';
      tipHtml += '<div style="font-size:0.66rem;color:#94a3b8;margin-top:6px;">Works exactly like drag & drop</div>';
      window._pasteTargetCell = cell;
      showMoveHintTip(tipHtml, clientX, clientY);
      const tip = document.getElementById('moveHintTip');
      if (tip) tip.style.pointerEvents = 'auto';
    }


    function applyMoveHintsForCell(cell, clientX, clientY) {
      if (!cell) return;
      clearMoveHints();
      const assigns = getAssignmentsFromCellEl(cell);
      if (!assigns.length) {
        showMoveHintTip(
          '<strong>No subject in this cell</strong><div class="mht-empty">Right-click a cell that already has a subject.</div>',
          clientX, clientY
        );
        if (typeof showToast === 'function') showToast('Right-click a cell that has a subject');
        return;
      }

      cell.classList.add('move-hint-source');
      window._moveHintSource = {
        assignmentIds: assigns.map(a => a.id).filter(Boolean),
        cell: cell
      };

      const lines = [];
      const targetMap = {}; // key day|slotId → { day, slotId, slotLabel, time, assignmentIds[] }

      assigns.forEach(a => {
        const subj = state.subjects.find(s => s.id === a.subjectId);
        const cls = state.classes.find(c => c.id === a.classId);
        // Study full timetable — no small limit for highlighting
        const alts = findFreeAlternatives(a.classId, a.subjectId, a.day, a.slotId, 200, a.id);
        const label = (subj ? subj.name : '?') + (cls ? ' · ' + cls.name : '');
        if (!alts.length) {
          lines.push({ label: label, empty: true, alts: [] });
          return;
        }
        lines.push({
          label: label,
          empty: false,
          alts: alts.map(alt => alt.day + ' · ' + alt.slotLabel + (alt.time ? ' (' + alt.time + ')' : ''))
        });
        alts.forEach(alt => {
          const key = alt.day + '|' + alt.slotId;
          if (!targetMap[key]) {
            targetMap[key] = {
              day: alt.day,
              slotId: alt.slotId,
              slotLabel: alt.slotLabel,
              time: alt.time,
              assignmentIds: []
            };
          }
          if (a.id) targetMap[key].assignmentIds.push(a.id);
        });
      });

      const srcClass = cell.getAttribute('data-class-id') || (assigns[0] && assigns[0].classId) || '';
      let highlightCount = 0;
      Object.keys(targetMap).forEach(key => {
        const day = targetMap[key].day;
        const slotId = targetMap[key].slotId;
        document.querySelectorAll('table.timetable td.slot[data-day="' + day + '"][data-slot-id="' + slotId + '"]').forEach(td => {
          if (td === cell) return;
          if (srcClass) {
            const tdClass = td.getAttribute('data-class-id') || '';
            if (tdClass && tdClass !== srcClass) return;
          }
          td.classList.add('move-hint-target');
          td.setAttribute('data-move-target', key);
          td.title = 'Click to move subject here (free, no clash)';
          highlightCount++;
        });
      });

      const totalAlts = Object.keys(targetMap).length;
      let tipHtml = '<strong>Where this subject can still go</strong>';
      tipHtml += '<div style="font-size:0.68rem;color:#94a3b8;margin-top:2px;">Green cells are free · click one to move · Esc to cancel</div>';
      lines.forEach(row => {
        if (row.empty) {
          tipHtml += '<div class="mht-empty">' + escapeHtml(row.label) + ': nowhere free</div>';
        } else {
          const shown = row.alts.slice(0, 10);
          const more = row.alts.length > 10 ? ' (+' + (row.alts.length - 10) + ' more)' : '';
          tipHtml += '<div class="mht-line">' + escapeHtml(row.label) + ' → ' + escapeHtml(shown.join(', ')) + escapeHtml(more) + '</div>';
        }
      });
      tipHtml += '<div style="font-size:0.7rem;color:#cbd5e1;margin-top:6px;">' + totalAlts + ' free slot' + (totalAlts === 1 ? '' : 's') + ' highlighted</div>';
      // Copy & Paste addon - under the free slots list
      tipHtml += '<div style="margin-top:12px;padding-top:10px;border-top:1px solid #334155;">';
      tipHtml += '<div style="font-size:0.72rem;font-weight:700;color:#e2e8f0;margin-bottom:6px;">Copy & Paste (same as drag & drop)</div>';
      tipHtml += '<div style="display:flex;gap:6px;flex-wrap:wrap;">';
      tipHtml += '<button type="button" onclick="handleCopyFromHint(\'copy\'); event.stopPropagation();" style="background:#0ea5e9;color:white;border:none;padding:5px 10px;border-radius:6px;font-weight:700;cursor:pointer;font-size:0.75rem;">📋 Copy</button>';
      tipHtml += '<button type="button" onclick="handleCopyFromHint(\'cut\'); event.stopPropagation();" style="background:#f59e0b;color:white;border:none;padding:5px 10px;border-radius:6px;font-weight:700;cursor:pointer;font-size:0.75rem;">✂️ Cut</button>';
      tipHtml += '</div>';
      tipHtml += '<div style="font-size:0.65rem;color:#94a3b8;margin-top:6px;">Copy → right-click empty cell → Paste (auto teacher + quota check)</div>';
      tipHtml += '</div>';
      showMoveHintTip(tipHtml, clientX, clientY);
      const tipEl = document.getElementById('moveHintTip');
      if (tipEl) tipEl.style.pointerEvents = 'auto';


      if (typeof showToast === 'function') {
        if (totalAlts === 0) showToast('No free slots for this subject (teacher/class busy or rules block)');
        else showToast(totalAlts + ' free slot' + (totalAlts === 1 ? '' : 's') + ' — click a green cell to move');
      }
    }

    function tryMoveToHintTarget(td) {
      const key = td && td.getAttribute('data-move-target');
      if (!key || !window._moveHintSource) return false;
      const ids = window._moveHintSource.assignmentIds || [];
      if (!ids.length) return false;
      const bar = key.indexOf('|');
      const newDay = key.slice(0, bar);
      const newSlotId = key.slice(bar + 1);
      // Move first assignment (or all if same subject/class multi - move each)
      let moved = 0;
      ids.forEach(aid => {
        if (typeof moveAssignmentTo === 'function') {
          const before = state.assignments.find(a => a.id === aid);
          if (!before) return;
          moveAssignmentTo(aid, newDay, newSlotId);
          moved++;
        }
      });
      clearMoveHints();
      window._moveHintSource = null;
      if (moved && typeof showToast === 'function') {
        showToast('Moved to ' + newDay + ' · ' + (state.slots.find(s => s.id === newSlotId) || {}).label);
      }
      return moved > 0;
    }

    function bindMoveHintHandlers(table) {
      initMoveHintGlobal();
    }

    function initMoveHintGlobal() {
      if (window._moveHintGlobalBound) return;
      window._moveHintGlobalBound = true;

      document.addEventListener('contextmenu', function (e) {
        const cell = e.target.closest && e.target.closest('td.slot');
        if (!cell) return;
        if (!cell.closest('table.timetable')) return;
        if (cell.classList.contains('break-slot') || cell.classList.contains('jumat-slot')) return;

        const hasAssign = !!(cell.getAttribute('data-assign-ids') || '').trim();
        const hasCoords = cell.getAttribute('data-day') && cell.getAttribute('data-slot-id');
        if (!hasAssign && !hasCoords) return;

        const assigns = getAssignmentsFromCellEl(cell);
        if (assigns.length) {
          e.preventDefault();
          e.stopPropagation();
          applyMoveHintsForCell(cell, e.clientX, e.clientY);
          return;
        }
        // Empty cell but clipboard exists -> show paste
        if (!assigns.length && window._timetableClipboard && window._timetableClipboard.assignIds && window._timetableClipboard.assignIds.length) {
          e.preventDefault();
          e.stopPropagation();
          clearMoveHints();
          showPasteTipForCell(cell, e.clientX, e.clientY);
          return;
        }
      }, true);

      // Click a green target → move subject there
      document.addEventListener('click', function (e) {
        const td = e.target.closest && e.target.closest('td.slot.move-hint-target');
        if (td && td.getAttribute('data-move-target')) {
          e.preventDefault();
          e.stopPropagation();
          tryMoveToHintTarget(td);
          return;
        }
        const tip = document.getElementById('moveHintTip');
        if (!tip || !tip.classList.contains('show')) return;
        if (e.target.closest && e.target.closest('#moveHintTip')) return;
        // Don't clear if clicking the source (left-click opens assign modal)
        clearMoveHints();
        window._moveHintSource = null;
      }, true);

      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          clearMoveHints();
          window._moveHintSource = null;
        }
      });
    }

    /**
     * Find free day+period cells for a class+subject (teacher free, class free, rules OK).
     * excludeDay/excludeSlotId skip the current (clashing) cell.
     */
    function findFreeAlternatives(classId, subjectId, excludeDay, excludeSlotId, limit, excludeAssignmentId) {
      limit = limit == null ? 50 : limit;
      const subj = state.subjects.find(s => s.id === subjectId);
      if (!subj) return [];
      // Cannot place if another teacher already teaches this subject name in the class
      if (findOtherTeacherForSubjectInClass(subj.name, subj.teacher, classId, subjectId)) return [];
      const teacher = (subj.teacher || '').toLowerCase().trim();
      const teachingSlots = state.slots.filter(s => !s.isBreak);
      const results = [];

      state.days.forEach(day => {
        teachingSlots.forEach(slot => {
          if (excludeDay && excludeSlotId && day === excludeDay && slot.id === excludeSlotId) return;
          if (isJumatCell(day, slot)) return;

          // Class already has something this slot? (ignore the assignment we would move)
          if (state.assignments.some(a => a.day === day && a.slotId === slot.id && a.classId === classId && a.id !== excludeAssignmentId)) return;

          // Teacher busy? (combined arms of same subject are OK; exclude moving assignment)
          if (teacher && teacherBusyInSlot(subj.teacher, day, slot.id, classId, subj, excludeAssignmentId || null)) return;

          // Same-day subject rule (double period etc.)
          const rule = checkSameDaySubjectRule(subjectId, classId, day, slot.id);
          if (!rule.ok) return;

          // Quota: only if placing an extra period (for suggestions when moving, quota is fine if we're moving)
          results.push({
            day,
            slotId: slot.id,
            slotLabel: slot.label,
            time: (slot.start && slot.end) ? (slot.start + '–' + slot.end) : ''
          });
        });
      });

      return results.slice(0, limit);
    }

    /** Move an existing assignment to another day/slot (used from clash suggestions). */
    function moveAssignmentTo(assignmentId, newDay, newSlotId) {
      const a = state.assignments.find(x => x.id === assignmentId);
      if (!a) { showToast('Assignment not found'); return; }

      // Target class busy?
      if (state.assignments.some(x =>
        x.id !== assignmentId && x.day === newDay && x.slotId === newSlotId && x.classId === a.classId
      )) {
        showToast('That cell is no longer free for this class');
        return;
      }

      const subj = state.subjects.find(s => s.id === a.subjectId);
      const teacher = subj ? (subj.teacher || '').toLowerCase().trim() : '';
      if (teacher) {
        if (teacherBusyInSlot(subj.teacher, newDay, newSlotId, a.classId, subj, assignmentId)) {
          showToast('Teacher is busy in that period');
          return;
        }
      }

      const rule = checkSameDaySubjectRule(a.subjectId, a.classId, newDay, newSlotId);
      // When moving, exclude current slot from same-day check by temporarily removing
      // checkSameDaySubjectRule already excludes newSlotId only as exclude for existing on day - need care
      // Simpler: set day/slot first after validating with temporary filter
      if (!rule.ok) {
        // Allow if the only same-day issue is the assignment we're moving
        const othersSameDay = state.assignments.filter(x =>
          x.id !== assignmentId && x.subjectId === a.subjectId && x.classId === a.classId && x.day === newDay
        );
        if (othersSameDay.length) {
          showToast('Cannot move: same-day subject rule');
          return;
        }
      }

      a.day = newDay;
      a.slotId = newSlotId;
      delete a.grouped;
      delete a.groupName;
      renderTable();
      renderSubjects();
      updateConflicts();
      if (state.currentSlot) {
        renderModalEntries();
        checkPotentialClash();
      }
      const slot = state.slots.find(s => s.id === newSlotId);
      showToast('Moved to ' + newDay + (slot ? ' · ' + slot.label : ''));
      pushHistory();
    }

    function countSubjectForClass(subjectId, classId) {
      return state.assignments.filter(a => a.subjectId === subjectId && a.classId === classId).length;
    }

    function getQuotaFor(subjectId, classId) {
      return getWeeklyFor(subjectId, classId);
    }


    function slotIndex(slotId) {
      return state.slots.findIndex(s => s.id === slotId);
    }

    function getSlotTime(day, slotId) {
      const base = state.slots.find(s => s.id === slotId);
      if (!base) return { start: '', end: '', isCustom: false };
      if (state.usePerDayTimes && state.daySlotTimes && state.daySlotTimes[day] && state.daySlotTimes[day][slotId]) {
        const custom = state.daySlotTimes[day][slotId];
        return { start: custom.start || base.start || '', end: custom.end || base.end || '', isCustom: true };
      }
      return { start: base.start || '', end: base.end || '', isCustom: false };
    }

    function setDaySlotTime(day, slotId, start, end) {
      if (!state.daySlotTimes[day]) state.daySlotTimes[day] = {};
      if (!state.daySlotTimes[day][slotId]) state.daySlotTimes[day][slotId] = {};
      state.daySlotTimes[day][slotId].start = start;
      state.daySlotTimes[day][slotId].end = end;
    }



    /** True if two teaching slots are immediate neighbours with no break between them */
    function slotsAreConsecutive(slotIdA, slotIdB) {
      const i = slotIndex(slotIdA);
      const j = slotIndex(slotIdB);
      if (i < 0 || j < 0) return false;
      const lo = Math.min(i, j);
      const hi = Math.max(i, j);
      if (hi - lo !== 1) return false; // must be next to each other in the list
      // both must be teaching periods (not breaks)
      if (state.slots[lo].isBreak || state.slots[hi].isBreak) return false;
      return true;
    }

    function existingSubjectSlotsOnDay(subjectId, classId, day, excludeSlotId) {
      return state.assignments
        .filter(a => a.subjectId === subjectId && a.classId === classId && a.day === day && a.slotId !== excludeSlotId)
        .map(a => a.slotId);
    }

    /**
     * Same subject on the same day for a class only if all occurrences form one
     * contiguous block of consecutive periods (no gap / break between them).
     */
    function checkSameDaySubjectRule(subjectId, classId, day, newSlotId) {
      const newSlot = state.slots.find(s => s.id === newSlotId);
      if (!newSlot || newSlot.isBreak) return { ok: false, message: 'Invalid period' };

      const existingHere = state.assignments.find(a =>
        a.day === day && a.slotId === newSlotId && a.classId === classId && a.subjectId === subjectId
      );
      if (existingHere) return { ok: true, message: '' };

      const existing = existingSubjectSlotsOnDay(subjectId, classId, day, newSlotId);
      if (existing.length === 0) return { ok: true, message: '' };

      const subj = state.subjects.find(s => s.id === subjectId);
      const cls = state.classes.find(c => c.id === classId);
      const labels = existing.map(id => {
        const sl = state.slots.find(s => s.id === id);
        return sl ? sl.label : '?';
      }).join(', ');
      const quota = getQuotaFor(subjectId, classId);

      // FIX: 2 periods/week rule only applies when Rule 3 (Double period controls) is properly configured
      if (quota > 0 && quota <= 2) {
        const isForcedDouble = typeof subjectForcesDouble === 'function' ? subjectForcesDouble(subjectId) : false;
        const isNoDouble = typeof subjectSkipsDouble === 'function' ? subjectSkipsDouble(subjectId) : false;
        if (!isForcedDouble && !isNoDouble) {
          return { ok: true, message: '' }; // Rule does NOT apply unless Rule 3 configured
        }
        if (isNoDouble) {
          return {
            ok: false,
            message: '🚫 <strong>' + escapeHtml(subj ? subj.name : 'Subject') + '</strong> is allotted only <strong>' + quota + '×/week</strong> for <strong>' + escapeHtml(cls ? cls.name : 'class') +
              '</strong>. Double periods are not allowed (Rule 3: No Double) — place periods on different days. Already on ' + escapeHtml(day) + ' (' + escapeHtml(labels) + ').'
          };
        }
        if (isForcedDouble) {
          const proposed = existing.concat([newSlotId]);
          const indices = proposed.map(slotIndex).filter(i => i >= 0).sort((a, b) => a - b);
          for (let k = 0; k < indices.length - 1; k++) {
            if (indices[k+1] !== indices[k] + 1) {
              return {
                ok: false,
                message: '🚫 <strong>' + escapeHtml(subj ? subj.name : 'Subject') + '</strong> for <strong>' + escapeHtml(cls ? cls.name : 'class') +
                  '</strong> must be a consecutive double period (Rule 3: Force Double). Already on ' + escapeHtml(day) + ' (' + escapeHtml(labels) + ') — choose the next consecutive period.'
              };
            }
            if (state.slots[indices[k]].isBreak || state.slots[indices[k+1]].isBreak) {
              return { ok: false, message: '🚫 Double cannot cross a break.' };
            }
          }
          return { ok: true, message: '' };
        }
      }

      // Quota 3+: allow only consecutive back-to-back periods on the same day
      const proposed = existing.concat([newSlotId]);
      const indices = proposed.map(slotIndex).filter(i => i >= 0).sort((a, b) => a - b);

      for (let k = 0; k < indices.length - 1; k++) {
        const a = indices[k];
        const b = indices[k + 1];
        if (b !== a + 1) return failMsg();
        if (state.slots[a].isBreak || state.slots[b].isBreak) return failMsg();
      }
      for (let i = indices[0]; i <= indices[indices.length - 1]; i++) {
        if (state.slots[i].isBreak) return failMsg();
        if (proposed.indexOf(state.slots[i].id) < 0) return failMsg();
      }
      return { ok: true, message: '' };

      function failMsg() {
        return {
          ok: false,
          message: '🚫 <strong>' + escapeHtml(subj ? subj.name : 'Subject') + '</strong> for <strong>' + escapeHtml(cls ? cls.name : 'class') +
            '</strong> is already on <strong>' + escapeHtml(day) + '</strong> (' + escapeHtml(labels) +
            '). Same subject on one day is only allowed in consecutive periods (back-to-back double period).'
        };
      }
    }


    /** Prior concurrent subject groups for this class that include subjectId (other cells). */
    function findPriorSubjectGroups(classId, subjectId, excludeDay, excludeSlotId) {
      const mapSameClass = {};
      const mapAnyClass = {};
      (state.assignments || []).forEach(a => {
        if (a.day === excludeDay && a.slotId === excludeSlotId) return;
        if (a.classId === classId) {
          const k = a.day + '|' + a.slotId;
          if (!mapSameClass[k]) mapSameClass[k] = [];
          mapSameClass[k].push(a);
        }
        const k2 = a.day + '|' + a.slotId;
        if (!mapAnyClass[k2]) mapAnyClass[k2] = [];
        mapAnyClass[k2].push(a);
      });
      const groups = [];
      Object.keys(mapSameClass).forEach(k => {
        const arr = mapSameClass[k];
        if (arr.length < 2) return;
        if (!arr.some(a => a.subjectId === subjectId)) return;
        const parts = k.split('|');
        groups.push({
          day: parts[0],
          slotId: parts.slice(1).join('|'),
          subjectIds: arr.map(a => a.subjectId),
          groupName: arr.map(a => a.groupName).find(Boolean) || 'Group',
          source: 'same-class',
          sourceClassId: classId
        });
      });
      Object.keys(mapAnyClass).forEach(k => {
        const arr = mapAnyClass[k];
        if (arr.length < 2) return;
        if (!arr.some(a => a.subjectId === subjectId)) return;
        const subjSet = arr.map(a=>a.subjectId).sort().join(',');
        if (groups.some(g=> g.subjectIds.slice().sort().join(',')===subjSet && g.source==='same-class')) return;
        const parts = k.split('|');
        const sourceClassId = arr[0].classId;
        const sourceClassName = (state.classes.find(c=>c.id===sourceClassId)||{}).name || sourceClassId;
        groups.push({
          day: parts[0],
          slotId: parts.slice(1).join('|'),
          subjectIds: arr.map(a => a.subjectId),
          groupName: arr.map(a => a.groupName).find(Boolean) || 'Group (from '+sourceClassName+')',
          source: 'cross-class',
          sourceClassId: sourceClassId,
          sourceClassName: sourceClassName
        });
      });
      groups.sort((a, b) => {
        if (a.source!==b.source) return a.source==='same-class' ? -1 : 1;
        return b.subjectIds.length - a.subjectIds.length;
      });
      return groups;
    }

    /** Prior same-period class arms that share subjectId with this class (other cells). */
    function findPriorArmGroups(classId, subjectId, excludeDay, excludeSlotId) {
      const map = {};
      (state.assignments || []).forEach(a => {
        if (a.subjectId !== subjectId) return;
        if (a.day === excludeDay && a.slotId === excludeSlotId) return;
        const k = a.day + '|' + a.slotId;
        if (!map[k]) map[k] = [];
        if (map[k].indexOf(a.classId) < 0) map[k].push(a.classId);
      });
      const groups = [];
      Object.keys(map).forEach(k => {
        const cids = map[k];
        if (cids.length < 2) return;
        if (cids.indexOf(classId) < 0) return;
        const parts = k.split('|');
        groups.push({
          day: parts[0],
          slotId: parts.slice(1).join('|'),
          classIds: cids.slice()
        });
      });
      groups.sort((a, b) => b.classIds.length - a.classIds.length);
      return groups;
    }

    function subjectLabelById(sid) {
      const s = state.subjects.find(x => x.id === sid);
      return s ? s.name : '?';
    }
    function classLabelById(cid) {
      const c = state.classes.find(x => x.id === cid);
      return c ? c.name : '?';
    }

    /**
     * Try to place one assignment without opening further autofill prompts.
     * Returns true if placed (or already present).
     */
    function tryPlaceAssignmentQuiet(day, slotId, classId, subjectId, groupName) {
      const slotObj = state.slots.find(s => s.id === slotId);
      if (isJumatCell(day, slotObj)) return false;
      if (state.assignments.some(a =>
        a.day === day && a.slotId === slotId && a.classId === classId && a.subjectId === subjectId
      )) return true;

      const subjForRule = state.subjects.find(s => s.id === subjectId);
      if (subjForRule && !window._forceAddActive) {
        const dualTeacher = findOtherTeacherForSubjectInClass(
          subjForRule.name, subjForRule.teacher, classId, subjectId
        );
        if (dualTeacher) return false;
      }

      const quota = getQuotaFor(subjectId, classId);
      const currentCount = countSubjectForClass(subjectId, classId);
      if (!window._forceAddActive) {
        if (quota > 0 && currentCount >= quota) return false;
        if (quota === 0) return false;
        const dayRule = checkSameDaySubjectRule(subjectId, classId, day, slotId);
        if (!dayRule.ok) return false;
        if (wouldCreateSecondDouble(subjectId, classId, day, slotId)) return false;
        if (subjForRule && teacherBusyInSlot(subjForRule.teacher, day, slotId, classId, subjForRule, null)) {
          // still allow group fill — user confirmed; skip strict clash block unless we want block
          // Prefer not placing clash silently: return false
          return false;
        }
      }

      const othersHere = state.assignments.filter(a =>
        a.day === day && a.slotId === slotId && a.classId === classId
      );
      const gname = groupName || othersHere.map(a => a.groupName).find(Boolean) || 'Group';
      state.assignments.push({
        id: 'a' + Date.now() + Math.random().toString(36).slice(2, 6),
        day, slotId, classId, subjectId,
        grouped: othersHere.length > 0 || !!groupName,
        groupName: (othersHere.length > 0 || groupName) ? gname : undefined,
        autoGenerated: false
      });
      if (othersHere.length > 0 || groupName) {
        othersHere.forEach(a => {
          a.grouped = true;
          if (!a.groupName) a.groupName = gname;
        });
      }
      return true;
    }

    function addAssignment() {
      const classId = document.getElementById('assignClass').value;
      const subjectId = document.getElementById('assignSubject').value;
      if (!classId || !subjectId) { showToast('Select both class and subject'); return; }

      const { day, slotId } = state.currentSlot;
      const slotObj = state.slots.find(s => s.id === slotId);
      if (isJumatCell(day, slotObj)) {
        showToast('JUMAT — Friday ' + getJumatSlotLabel() + ' is blocked for all classes');
        return;
      }

      // --- Autofill offer from prior groupings + CROSS-CLASS IMITATION ---
      if (!window._skipGroupAutofill) {
        const subjGroups = findPriorSubjectGroups(classId, subjectId, day, slotId);
        const armGroups = findPriorArmGroups(classId, subjectId, day, slotId);
        const learnedGroupsForSubject = (state.autoGenRules && state.autoGenRules.subjectGroups || []).filter(g=> (g.subjectIds||[]).indexOf(subjectId)>=0);
        learnedGroupsForSubject.forEach(g=>{
          const exists = subjGroups.some(sg=> sg.subjectIds.slice().sort().join(',') === (g.subjectIds||[]).slice().sort().join(','));
          if (!exists) {
            subjGroups.push({
              day: 'Learned',
              slotId: 'rule',
              subjectIds: g.subjectIds.slice(),
              groupName: g.name || 'Learned Group',
              source: 'learned-rule',
              sourceClassName: (g.classIds||[]).map(cid=> (state.classes.find(c=>c.id===cid)||{}).name||cid).join(', ')
            });
          }
        });
        // Subjects already in this cell for this class
        const alreadyHere = state.assignments
          .filter(a => a.day === day && a.slotId === slotId && a.classId === classId)
          .map(a => a.subjectId);
        let offerSubjects = [subjectId];
        let offerClasses = [classId];
        let groupName = 'Group';
        let lines = [];

        if (subjGroups.length) {
          const g = subjGroups[0];
          offerSubjects = Array.from(new Set(g.subjectIds.concat([subjectId])));
          groupName = g.groupName || 'Group';
          const missing = offerSubjects.filter(sid => alreadyHere.indexOf(sid) < 0);
          if (offerSubjects.length > 1 && missing.length > 0) {
            const names = offerSubjects.map(subjectLabelById).join(', ');
            const srcSlot = (state.slots.find(s => s.id === g.slotId) || {}).label || g.slotId;
            let srcInfo = '';
            if (g.source==='cross-class') {
              srcInfo = ' (learned from '+ (g.sourceClassName||'other class') +' · '+g.day+' · '+srcSlot+') — will imitate grouping in '+classLabelById(classId);
            } else if (g.source==='learned-rule') {
              srcInfo = ' (learned rule from '+(g.sourceClassName||'previous')+')';
            } else {
              srcInfo = ' (from '+g.day+' · '+srcSlot+')';
            }
            lines.push('• Subjects grouped for ' + classLabelById(classId) + ': ' + names + srcInfo);
          } else {
            offerSubjects = [subjectId];
          }
        }

        if (armGroups.length) {
          const g = armGroups[0];
          offerClasses = Array.from(new Set(g.classIds.concat([classId])));
          if (offerClasses.length > 1) {
            const names = offerClasses.map(classLabelById).join(', ');
            const srcSlot = (state.slots.find(s => s.id === g.slotId) || {}).label || g.slotId;
            lines.push('• Classes that shared this subject in one period: ' + names +
              ' (from ' + g.day + ' · ' + srcSlot + ')');
          } else {
            offerClasses = [classId];
          }
        }

        const willAutofillSubjects = offerSubjects.length > 1;
        const willAutofillArms = offerClasses.length > 1;
        if (lines.length && (willAutofillSubjects || willAutofillArms)) {
          const msg =
            'Autofill from an earlier grouping?\n\n' +
            lines.join('\n') +
            '\n\nOK = fill this cell with the same group\nCancel = add only the selected subject/class';
          if (confirm(msg)) {
            let placed = 0;
            // Subject group for the selected class
            if (willAutofillSubjects) {
              offerSubjects.forEach(sid => {
                if (tryPlaceAssignmentQuiet(day, slotId, classId, sid, groupName)) placed++;
              });
            } else {
              if (tryPlaceAssignmentQuiet(day, slotId, classId, subjectId, null)) placed++;
            }
            // Combined arms: place selected subject (and full subject group if any) on other classes
            if (willAutofillArms) {
              offerClasses.forEach(cid => {
                if (cid === classId) return;
                const sids = willAutofillSubjects ? offerSubjects : [subjectId];
                sids.forEach(sid => {
                  if (tryPlaceAssignmentQuiet(day, slotId, cid, sid, willAutofillSubjects ? groupName : null)) placed++;
                });
              });
            }
            window._forceAddActive = false;
            const _resetBtns = document.querySelectorAll('#assignModal .btn-primary');
            _resetBtns.forEach(b => { b.style.background = ''; b.textContent = '+ Add to this slot'; });
            renderModalEntries();
            renderTable();
            renderSubjects();
            updateConflicts();
            checkPotentialClash();
            if (window._fillSubjectOptions) window._fillSubjectOptions();
            checkQuotaWarning();
            checkSameDayWarning();
            pushHistory();
            showToast(placed ? ('Autofilled ' + placed + ' placement(s)') : 'Nothing new to fill (limits or clashes)');
            return;
          }
          // Cancel → fall through and add only the selected pair
        }
      }

      const subjForRule = state.subjects.find(s => s.id === subjectId);
      if (subjForRule && !window._forceAddActive) {
        const dualTeacher = findOtherTeacherForSubjectInClass(
          subjForRule.name, subjForRule.teacher, classId, subjectId
        );
        if (dualTeacher) {
          const cls = state.classes.find(c => c.id === classId);
          showToast(
            (subjForRule.name || 'Subject') + ' for ' + (cls ? cls.name : 'class') +
            ' is already taught by ' + (dualTeacher.subject.teacher || '?')
          );
          return;
        }
      }

      // Same subject already in this class+period?
      const sameSubjectHere = state.assignments.find(a =>
        a.day === day && a.slotId === slotId && a.classId === classId && a.subjectId === subjectId
      );
      if (sameSubjectHere) {
        showToast('This subject is already in this period for the class');
        return;
      }

      const othersHere = state.assignments.filter(a =>
        a.day === day && a.slotId === slotId && a.classId === classId
      );
      const quota = getQuotaFor(subjectId, classId);
      const currentCount = countSubjectForClass(subjectId, classId);

      // Same subject on same day only if consecutive periods - respect force flag
      const dayRule = checkSameDaySubjectRule(subjectId, classId, day, slotId);
      if (!dayRule.ok && !window._forceAddActive) {
        showToast('Same subject only allowed in consecutive periods on the same day');
        return;
      }
      if (wouldCreateSecondDouble(subjectId, classId, day, slotId) && !window._forceAddActive) {
        showToast('Only one double period allowed per subject for this class');
        return;
      }

      if (quota > 0 && currentCount >= quota && !window._forceAddActive) {
        const subj = state.subjects.find(s => s.id === subjectId);
        const cls = state.classes.find(c => c.id === classId);
        showToast((subj ? subj.name : 'Subject') + ' already at weekly limit (' + currentCount + '/' + quota + ') for ' + (cls ? cls.name : 'class'));
        return;
      }
      if (quota === 0 && !window._forceAddActive) {
        const subj = state.subjects.find(s => s.id === subjectId);
        const cls = state.classes.find(c => c.id === classId);
        showToast((subj ? subj.name : 'Subject') + ' is set to 0×/week for ' + (cls ? cls.name : 'class') + ' — update subject frequency first');
        return;
      }

      // Allow multiple subjects in the same period for one class (subject grouping / concurrent)
      const existingGroupName = othersHere.map(a => a.groupName).find(Boolean) || 'Group';
      state.assignments.push({
        id: 'a' + Date.now() + Math.random().toString(36).slice(2, 6),
        day, slotId, classId, subjectId,
        grouped: othersHere.length > 0,
        groupName: othersHere.length > 0 ? existingGroupName : undefined
      });
      // Mark existing ones as grouped when we add a concurrent subject
      if (othersHere.length > 0) {
        othersHere.forEach(a => {
          a.grouped = true;
          if (!a.groupName) a.groupName = existingGroupName;
        });
        showToast('Added to “' + existingGroupName + '” — ' + (othersHere.length + 1) + ' subjects in this period');
      } else {
        showToast('Assignment added');
      }
      window._forceAddActive = false;
      const _resetBtns = document.querySelectorAll('#assignModal .btn-primary');
      _resetBtns.forEach(b => { b.style.background = ''; b.textContent = '+ Add to this slot'; });
      renderModalEntries();
      renderTable();
      renderSubjects();
      updateConflicts();
      checkPotentialClash();
      if (window._fillSubjectOptions) window._fillSubjectOptions();
      checkQuotaWarning();
      checkSameDayWarning();
      pushHistory();
    }

    function assignmentIsLocked(a) {
      return !!(a && a.locked);
    }

    function toggleAssignmentLock(id) {
      const a = state.assignments.find(x => x.id === id);
      if (!a) return;
      a.locked = !a.locked;
      if (a.locked) {
        // Locked periods are protected from Clear Auto / regenerate
        a.autoGenerated = false;
      }
      renderModalEntries();
      renderTable();
      if (typeof renderCompareLeft === 'function') {
        try { renderCompareLeft(); renderCompareRight(); } catch (e) {}
      }
      showToast(a.locked ? '🔒 Locked — kept on Clear Auto / regenerate' : '🔓 Unlocked');
      pushHistory();
    }

    function removeAssignment(id) {
      const removed = state.assignments.find(a => a.id === id);
      if (removed && assignmentIsLocked(removed)) {
        if (!confirm('This period is locked.\n\nOK = Unlock and remove\nCancel = Keep it')) return;
      }
      state.assignments = state.assignments.filter(a => a.id !== id);
      // If a concurrent group is down to one subject, clear group metadata
      if (removed) {
        const remaining = state.assignments.filter(a =>
          a.day === removed.day && a.slotId === removed.slotId && a.classId === removed.classId
        );
        if (remaining.length <= 1) {
          remaining.forEach(a => { delete a.grouped; delete a.groupName; });
        }
      }
      renderModalEntries();
      renderTable();
      renderSubjects();
      updateConflicts();
      checkPotentialClash();
      if (window._fillSubjectOptions) window._fillSubjectOptions();
      checkQuotaWarning();
      checkSameDayWarning();
      showToast('Assignment removed');
      pushHistory();
    }

    function updateConflicts() {
      const clashes = getTeacherClashes();
      const panel = document.getElementById('conflictsPanel');
      const headLabel = document.getElementById('conflictsHeadLabel');
      const card = document.getElementById('conflictsCard');
      if (!panel) return;
      const keys = Object.keys(clashes);

      if (keys.length === 0) {
        panel.className = 'conflicts-box ok';
        panel.innerHTML = '<p style="color:var(--muted);font-size:0.8rem;">All teachers are free in their assigned slots.</p>';
        if (headLabel) headLabel.textContent = '✅ No clashes';
        if (card) {
          card.classList.add('no-clashes');
          card.classList.remove('has-clashes');
        }
        return;
      }

      panel.className = 'conflicts-box';
      if (headLabel) {
        headLabel.textContent = '⚠️ ' + keys.length + ' clash' + (keys.length > 1 ? 'es' : '');
      }
      if (card) {
        card.classList.add('has-clashes');
        card.classList.remove('no-clashes');
      }
      let html = '<p style="font-size:0.75rem;color:#7f1d1d;margin-bottom:8px;">Tap a clash to jump · click <strong>Move</strong> to resolve.</p>';
      keys.forEach(key => {
        const parts = key.split('|');
        const day = parts[0], slotId = parts[1], teacher = parts[2];
        const slot = state.slots.find(s => s.id === slotId);
        const arr = clashes[key];
        const firstClassId = (arr[0] && arr[0].classId) ? arr[0].classId : '';
        const classNames = arr.map(a => {
          const c = state.classes.find(x => x.id === a.classId);
          const s = state.subjects.find(x => x.id === a.subjectId);
          return (c?.name || '?') + ' (' + (s?.name || '?') + ')';
        }).join(' + ');
        const jumpArgs = '\'' + escapeHtml(day) + '\',\'' + escapeHtml(slotId) + '\',\'' + escapeHtml(firstClassId) + '\'';
        html += '<div class="conflict-item" onclick="jumpToClash(' + jumpArgs + ')" title="Jump to this cell on the timetable">' +
          '<strong>' + escapeHtml(teacher) + '</strong> · ' + escapeHtml(day) + ' · ' + (slot ? escapeHtml(slot.label) : '?') +
          '<br><span style="font-size:0.78rem;">' + escapeHtml(classNames) + '</span>' +
          '<div><button type="button" class="btn btn-secondary btn-xs conflict-jump-btn" onclick="event.stopPropagation(); jumpToClash(' + jumpArgs + ')">📍 Go to cell</button></div>';

        // Suggestions per involved class/subject
        arr.forEach(a => {
          const c = state.classes.find(x => x.id === a.classId);
          const s = state.subjects.find(x => x.id === a.subjectId);
          const alts = findFreeAlternatives(a.classId, a.subjectId, day, slotId, 4);
          const armJump = '\'' + escapeHtml(day) + '\',\'' + escapeHtml(slotId) + '\',\'' + escapeHtml(a.classId || '') + '\'';
          html += '<div style="margin-top:6px;padding:6px 8px;background:#fff7ed;border-radius:6px;font-size:0.75rem;" onclick="event.stopPropagation(); jumpToClash(' + armJump + ')">';
          html += '<div style="font-weight:600;color:#9a3412;">Move ' + escapeHtml(c ? c.name : '?') + ' · ' + escapeHtml(s ? s.name : '?') + ':</div>';
          if (!alts.length) {
            html += '<div style="color:#78716c;">No free cell for this class/teacher.</div>';
          } else {
            html += alts.map(alt =>
              '<div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:3px;">' +
              '<span>' + escapeHtml(alt.day) + ' · ' + escapeHtml(alt.slotLabel) +
              (alt.time ? ' <span style="color:#78716c;">(' + escapeHtml(alt.time) + ')</span>' : '') + '</span>' +
              '<button type="button" class="btn btn-primary btn-xs" onclick="event.stopPropagation(); moveAssignmentTo(\'' + a.id + '\',\'' + alt.day + '\',\'' + alt.slotId + '\')">Move</button>' +
              '</div>'
            ).join('');
          }
          html += '</div>';
        });
        html += '</div>';
      });
      panel.innerHTML = html;
    }


    // ========== UNDO / REDO ==========
    const HISTORY_MAX = 60;
    let historyStack = [];
    let historyIndex = -1;
    let historyQuiet = false;
    /** Snapshot string of last explicit Save (or load). Used for leave-page warning. */
    let lastSavedSnap = null;

    function getHistoryPayload() {
      return {
        schoolName: state.schoolName,
        session: state.session,
        days: state.days,
        slots: state.slots,
        examSlots: state.examSlots,
        examSchedule: state.examSchedule,
        classes: state.classes,
        subjects: state.subjects,
        assignments: state.assignments,
        exams: state.exams,
        autoGenRules: state.autoGenRules,
        showClassLoad: state.showClassLoad,
        showTeacherLoad: state.showTeacherLoad,
        printSubjectStyle: state.printSubjectStyle,
        selectedClassId: state.selectedClassId,
        selectedTeacher: state.selectedTeacher,
        currentView: state.currentView
      };
    }

    function snapshotHistory() {
      try {
        return JSON.stringify(getHistoryPayload());
      } catch (e) {
        return null;
      }
    }

    /** Last successful localStorage write (ms). Used for header “Saved · 2 min ago”. */
    let lastSaveAt = null;
    let lastSaveFailed = false;

    function formatSaveAge(ms) {
      if (ms == null || !isFinite(ms)) return null;
      const sec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
      if (sec < 8) return 'just now';
      if (sec < 60) return sec + 's ago';
      const min = Math.floor(sec / 60);
      if (min < 60) return min + ' min ago';
      const hr = Math.floor(min / 60);
      if (hr < 24) return hr + 'h ago';
      const day = Math.floor(hr / 24);
      return day + 'd ago';
    }

    /** Persist state immediately; flash a top-center notice anyone can see. */
    function autosaveNow() {
      const flash = document.getElementById('autosaveFlash');
      try {
        localStorage.setItem('schoolMasterTimetable', JSON.stringify(state));
        lastSavedSnap = snapshotHistory();
        lastSaveAt = Date.now();
        lastSaveFailed = false;
        if (flash) {
          flash.classList.remove('fail');
          flash.textContent = '✓ Autosaved';
          flash.classList.add('show');
          clearTimeout(window._autosaveFlashTimer);
          window._autosaveFlashTimer = setTimeout(function () {
            if (flash) flash.classList.remove('show');
          }, 1600);
        }
        updateDirtyIndicator();
      } catch (e) {
        lastSaveFailed = true;
        if (flash) {
          flash.classList.add('fail');
          flash.textContent = '⚠️ Autosave failed';
          flash.classList.add('show');
          clearTimeout(window._autosaveFlashTimer);
          window._autosaveFlashTimer = setTimeout(function () {
            if (flash) {
              flash.classList.remove('show', 'fail');
              flash.textContent = '✓ Autosaved';
            }
          }, 2500);
        }
        updateDirtyIndicator();
      }
      try {
        document.title = "Akeem's Timetable Generator";
      } catch (e) {}
    }

    function pushHistory() {
      if (historyQuiet) return;
      if (typeof invalidateLookupCaches === 'function') invalidateLookupCaches();
      const snap = snapshotHistory();
      if (!snap) return;
      if (historyIndex >= 0 && historyStack[historyIndex] === snap) {
        updateUndoRedoButtons();
        return;
      }
      // Drop any redo branch
      if (historyIndex < historyStack.length - 1) {
        historyStack = historyStack.slice(0, historyIndex + 1);
      }
      historyStack.push(snap);
      if (historyStack.length > HISTORY_MAX) {
        historyStack.shift();
      }
      historyIndex = historyStack.length - 1;
      updateUndoRedoButtons();
      // Immediate autosave on every meaningful change
      autosaveNow();
      updateDirtyIndicator();
    }

    function isTimetableDirty() {
      const cur = snapshotHistory();
      if (!cur) return false;
      if (lastSavedSnap == null) return historyIndex > 0;
      return cur !== lastSavedSnap;
    }

    function markTimetableSaved() {
      lastSavedSnap = snapshotHistory();
      if (!lastSaveFailed) {
        if (lastSaveAt == null) lastSaveAt = Date.now();
      }
      updateDirtyIndicator();
    }

    function updateDirtyIndicator() {
      // Autosave is always on — keep document title clean; show status in header
      try {
        document.title = "Akeem's Timetable Generator";
      } catch (e) {}
      const el = document.getElementById('saveStatus');
      const textEl = document.getElementById('saveStatusText');
      if (!el || !textEl) return;
      el.classList.remove('saved', 'unsaved', 'fail');
      if (lastSaveFailed) {
        el.classList.add('fail');
        textEl.textContent = 'Autosave failed — try Save or Export';
        el.title = 'Could not write to this device storage';
        return;
      }
      const dirty = typeof isTimetableDirty === 'function' && isTimetableDirty();
      if (dirty) {
        el.classList.add('unsaved');
        textEl.textContent = 'Unsaved changes';
        el.title = 'Changes not yet written — click Save or wait for autosave';
        return;
      }
      el.classList.add('saved');
      const age = formatSaveAge(lastSaveAt);
      if (age) {
        textEl.textContent = 'Saved · ' + age;
        el.title = lastSaveAt ? ('Last saved ' + new Date(lastSaveAt).toLocaleString()) : 'Saved on this device';
      } else {
        textEl.textContent = 'Saved on this device';
        el.title = 'Timetable is stored in this browser';
      }
    }

    function updateUndoRedoButtons() {
      const u = document.getElementById('btnUndo');
      const r = document.getElementById('btnRedo');
      if (u) u.disabled = historyIndex <= 0;
      if (r) r.disabled = historyIndex < 0 || historyIndex >= historyStack.length - 1;
    }

    function applyHistorySnapshot(snap) {
      if (!snap) return;
      let data;
      try { data = JSON.parse(snap); } catch (e) { return; }
      historyQuiet = true;
      try {
        state.schoolName = data.schoolName != null ? data.schoolName : state.schoolName;
        state.session = data.session != null ? data.session : '';
        state.days = data.days || state.days;
        state.slots = data.slots || state.slots;
        state.examSlots = data.examSlots || state.examSlots;
        state.examSchedule = data.examSchedule || [];
        state.classes = data.classes || [];
        state.subjects = data.subjects || [];
        state.assignments = data.assignments || [];
        state.exams = data.exams || [];
        if (data.autoGenRules) state.autoGenRules = data.autoGenRules;
        if (data.showClassLoad !== undefined) state.showClassLoad = data.showClassLoad;
        if (data.showTeacherLoad !== undefined) state.showTeacherLoad = data.showTeacherLoad;
        if (data.printSubjectStyle === 'plain' || data.printSubjectStyle === 'color') state.printSubjectStyle = data.printSubjectStyle;
        ensureAssignmentIds();
        state.selectedClassId = data.selectedClassId || null;
        state.selectedTeacher = data.selectedTeacher || null;
        state.currentView = PAGE_VIEW; /* PAGES: page decides the view */

        const nameEl = document.getElementById('schoolName');
        if (nameEl) nameEl.value = state.schoolName || 'My School';
        const daysEl = document.getElementById('daysInput');
        if (daysEl) daysEl.value = (state.days || []).join(', ');
        const sessEl = document.getElementById('sessionInput');
        if (sessEl) sessEl.value = state.session || '';

        renderSlots();
        renderExamSlots();
        renderClasses();
        renderSubjects();
        updateConflicts();
        updateMeta();
        switchView(state.currentView || 'school');
        renderTable();
      } finally {
        historyQuiet = false;
      }
      updateUndoRedoButtons();
    }

    function undo() {
      if (historyIndex <= 0) {
        showToast('Nothing to undo');
        return;
      }
      historyIndex--;
      applyHistorySnapshot(historyStack[historyIndex]);
      updateDirtyIndicator();
      showToast('Undone');
    }

    function redo() {
      if (historyIndex >= historyStack.length - 1) {
        showToast('Nothing to redo');
        return;
      }
      historyIndex++;
      applyHistorySnapshot(historyStack[historyIndex]);
      updateDirtyIndicator();
      showToast('Redone');
    }

    function initHistory() {
      historyStack = [];
      historyIndex = -1;
      pushHistory();
      markTimetableSaved();
      updateUndoRedoButtons();
    }

    function saveData() {
      // Kept for compatibility — autosave handles persistence
      if (typeof autosaveNow === 'function') autosaveNow();
      else {
        try { localStorage.setItem('schoolMasterTimetable', JSON.stringify(state)); } catch (e) {}
        markTimetableSaved();
      }
    }

    function loadData() {
      const raw = localStorage.getItem('schoolMasterTimetable');
      if (!raw) return;
      try {
        const data = JSON.parse(raw);
        if (data.numPeriods && !data.slots) {
          data.slots = [];
          for (let i = 0; i < (data.numPeriods || 8); i++) {
            const t = data.periodTimes?.[i] || {};
            data.slots.push({ id: 'p' + i, label: 'Period ' + (i + 1), start: t.start || '', end: t.end || '', isBreak: false });
          }
          if (data.assignments) {
            data.assignments = data.assignments.map(a => ({ ...a, slotId: a.slotId || ('p' + a.period) }));
          }
        }
        state = { ...state, ...data };
        state.currentView = PAGE_VIEW; /* PAGES: page decides the view */
        if (state.jumatEnabled == null) state.jumatEnabled = true;
        if (typeof ensureJumatSlotId === 'function') ensureJumatSlotId();
        document.getElementById('schoolName').value = state.schoolName || 'My School';
        document.getElementById('daysInput').value = (state.days || []).join(', ');
        const sessEl = document.getElementById('sessionInput');
        if (sessEl) sessEl.value = state.session || '';
        if (typeof syncJumatToggle === 'function') syncJumatToggle();
      } catch (e) { console.error(e); }
    }

    function clearAll() {
      if (!confirm('Clear everything?')) return;
      state.classes = [];
      state.subjects = [];
      state.assignments = [];
      state.exams = [];
      state.slots = [
        { id: 'p1', label: 'Period 1', start: '08:00', end: '08:45', isBreak: false },
        { id: 'p2', label: 'Period 2', start: '08:45', end: '09:30', isBreak: false },
        { id: 'b1', label: 'Short Break', start: '09:30', end: '09:45', isBreak: true },
        { id: 'p3', label: 'Period 3', start: '09:45', end: '10:30', isBreak: false },
        { id: 'p4', label: 'Period 4', start: '10:30', end: '11:15', isBreak: false },
        { id: 'b2', label: 'Lunch', start: '11:15', end: '12:00', isBreak: true },
        { id: 'p5', label: 'Period 5', start: '12:00', end: '12:45', isBreak: false },
        { id: 'p6', label: 'Period 6', start: '12:45', end: '13:30', isBreak: false },
        { id: 'p7', label: 'Period 7', start: '13:30', end: '14:15', isBreak: false },
        { id: 'p8', label: 'Period 8', start: '14:15', end: '15:00', isBreak: false },
        { id: 'p9', label: 'Period 9', start: '15:00', end: '15:45', isBreak: false },
      ];
      state.examSlots = [
        { id: 'ep1', label: 'Paper 1', start: '08:00', end: '10:00', isBreak: false },
        { id: 'eb1', label: 'Short Break', start: '10:00', end: '10:30', isBreak: true },
        { id: 'ep2', label: 'Paper 2', start: '10:30', end: '12:30', isBreak: false },
        { id: 'eb2', label: 'Lunch', start: '12:30', end: '13:30', isBreak: true },
        { id: 'ep3', label: 'Paper 3', start: '13:30', end: '15:30', isBreak: false },
      ];
      state.selectedClassId = null;
      state.selectedTeacher = null;
      renderSlots();
      renderExamSlots();
      renderClasses();
      renderSubjects();
      updateConflicts();
      updateMeta();
      switchView(state.currentView);
      localStorage.removeItem('schoolMasterTimetable');
      showToast('Reset to defaults');
      pushHistory();
    }

    function exportJSON() {
      updateMeta();
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'timetable-' + state.schoolName.replace(/\s+/g, '-') + '.json';
      a.click();
      URL.revokeObjectURL(url);
      showToast('Exported');
    }

    function importJSON(e) {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          state = { ...state, ...data };
        state.currentView = PAGE_VIEW; /* PAGES: page decides the view */
          if (state.jumatEnabled == null) state.jumatEnabled = true;
          if (typeof ensureJumatSlotId === 'function') ensureJumatSlotId();
          document.getElementById('schoolName').value = state.schoolName || 'My School';
          document.getElementById('daysInput').value = (state.days || []).join(', ');
          const sessEl = document.getElementById('sessionInput');
          if (sessEl) sessEl.value = state.session || '';
          if (!state.examSlots) state.examSlots = [];
          if (!state.exams) state.exams = [];
          if (typeof syncJumatToggle === 'function') syncJumatToggle();
          renderSlots();
          renderExamSlots();
          renderClasses();
          renderSubjects();
          updateConflicts();
          updateMeta();
          switchView(state.currentView || 'school');
          showToast('Imported successfully');
      pushHistory();
        } catch (err) { showToast('Invalid file'); }
      };
      reader.readAsText(file);
      e.target.value = '';
    }


    
        // ========== GO TO DAY/CLASS - CLEAN WORKING VERSION ==========
    window._gotoData = [];

    function buildGoToOptions() {
      const hidden = document.getElementById('gotoSelect');
      const input = document.getElementById('gotoInput');
      const controls = document.getElementById('gotoControls');
      if (!hidden || !input || !controls) return;
      const view = state.currentView;
      const allowedViews = ['school', 'compare'];
      const isCompareSchool = view === 'compare' && (!state.compareLeftView || state.compareLeftView === 'school');
      if (!allowedViews.includes(view) || (view === 'compare' && !isCompareSchool)) {
        controls.style.display = 'none';
        const p = document.getElementById('gotoPortal');
        if (p) p.style.display = 'none';
        return;
      }
      controls.style.display = 'flex';

      const days = state.days || [];
      const classes = state.classes || [];
      if (!days.length || !classes.length) {
        window._gotoData = [];
        input.placeholder = 'No days/classes yet';
        return;
      }

      const list = [];
      // Jump to Day on top
      days.forEach(day => {
        const firstCls = classes[0];
        if (!firstCls) return;
        const rowId = 'goto-' + slugifyForId(day) + '-' + slugifyForId(firstCls.id);
        list.push({ rowId, label: '📅 ' + day + ' (top)', day, clsName: '', group: 'Jump to Day (top)', search: (day + ' top').toLowerCase() });
      });
      // Day — Class
      days.forEach(day => {
        const daySlug = slugifyForId(day);
        classes.forEach(cls => {
          const rowId = 'goto-' + daySlug + '-' + slugifyForId(cls.id);
          const label = day + ' — ' + cls.name;
          list.push({ rowId, label, day, clsName: cls.name, group: day, search: (day + ' ' + cls.name).toLowerCase() });
        });
      });

      window._gotoData = list;
      // Build portal if not exists
      ensureGotoPortal();
      initGotoComboEvents();
      renderGotoPortal(input.value || '');
      // console.log('Goto data built', list.length);
    }

    function ensureGotoPortal() {
      let portal = document.getElementById('gotoPortal');
      if (portal) return portal;
      portal = document.createElement('div');
      portal.id = 'gotoPortal';
      portal.style.display = 'none';
      document.body.appendChild(portal);
      // Allow scrolling inside portal
      portal.addEventListener('wheel', (e) => { e.stopPropagation(); }, { passive: true });
      portal.addEventListener('touchmove', (e) => { e.stopPropagation(); }, { passive: true });
      portal.addEventListener('mousedown', (e) => { e.preventDefault(); }); // keep input focus
      portal.addEventListener('click', (e) => {
        const opt = e.target.closest('.goto-opt');
        if (!opt) return;
        const rowId = opt.getAttribute('data-row');
        // Jump then clear
        jumpToDayClass(rowId);
        const input = document.getElementById('gotoInput');
        const hidden = document.getElementById('gotoSelect');
        if (input) input.value = '';
        if (hidden) hidden.value = '';
        portal.style.display = 'none';
      });
      return portal;
    }

    function initGotoComboEvents() {
      const input = document.getElementById('gotoInput');
      const hidden = document.getElementById('gotoSelect');
      const toggle = document.getElementById('gotoToggle');
      if (!input || !hidden || input._gotoBound) return;
      input._gotoBound = true;

      const open = () => {
        renderGotoPortal(input.value || '');
        openGotoPortal();
        setTimeout(() => { try { input.select(); } catch(e){} }, 15);
      };

      input.addEventListener('focus', () => {
        open();
        setTimeout(() => { try { input.select(); } catch(e){} }, 15);
      });
      input.addEventListener('click', () => {
        open();
        setTimeout(() => { try { input.select(); } catch(e){} }, 15);
      });
      input.addEventListener('input', () => {
        hidden.value = '';
        renderGotoPortal(input.value || '');
        openGotoPortal();
      });
      input.addEventListener('keydown', (e) => {
        const portal = document.getElementById('gotoPortal');
        const visible = portal && portal.style.display === 'block';
        const items = portal ? Array.from(portal.querySelectorAll('.goto-opt')) : [];
        let idx = items.findIndex(el => el.classList.contains('highlight'));
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (!visible) { open(); return; }
          idx = Math.min((idx < 0 ? 0 : idx + 1), items.length - 1);
          highlightGoto(idx);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          idx = Math.max(idx - 1, 0);
          highlightGoto(idx);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (visible && items[idx]) {
            const rowId = items[idx].getAttribute('data-row');
            jumpToDayClass(rowId);
            input.value = '';
            hidden.value = '';
            const p = document.getElementById('gotoPortal');
            if (p) p.style.display = 'none';
          } else if (visible && items.length === 1) {
            const rowId = items[0].getAttribute('data-row');
            jumpToDayClass(rowId);
            input.value = '';
            hidden.value = '';
            const p = document.getElementById('gotoPortal');
            if (p) p.style.display = 'none';
          }
        } else if (e.key === 'Escape') {
          const p = document.getElementById('gotoPortal');
          if (p) p.style.display = 'none';
          input.value = '';
          hidden.value = '';
          input.blur();
        }
      });

      if (toggle && !toggle._gotoBound) {
        toggle._gotoBound = true;
        toggle.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const portal = document.getElementById('gotoPortal');
          if (portal && portal.style.display === 'block') {
            portal.style.display = 'none';
          } else {
            input.focus();
            renderGotoPortal(input.value || '');
            openGotoPortal();
          }
        });
      }
    }

    // Global outside click handler - close and wipe
    if (!window._gotoOutsideBound) {
      window._gotoOutsideBound = true;
      document.addEventListener('click', (e) => {
        const portal = document.getElementById('gotoPortal');
        const wrap = document.getElementById('gotoComboWrap');
        if (!portal) return;
        if (wrap && wrap.contains(e.target)) return;
        if (portal.contains(e.target)) return;
        // Clicked outside - wipe and close
        if (portal.style.display === 'block' || document.getElementById('gotoInput')) {
          const input = document.getElementById('gotoInput');
          const hidden = document.getElementById('gotoSelect');
          if (portal.style.display === 'block') {
            portal.style.display = 'none';
          }
          // Wipe what was typed/selected
          if (input && wrap) {
            // Only wipe if not focusing inside
            if (document.activeElement !== input) {
              input.value = '';
              if (hidden) hidden.value = '';
            } else {
              // If input is still focused but clicked outside, blur and wipe
              setTimeout(() => {
                if (document.activeElement !== input) {
                  input.value = '';
                  if (hidden) hidden.value = '';
                }
              }, 150);
            }
          }
        }
      });
      // Extra blur wipe for reliability
      document.addEventListener('focusin', (e) => {
        // No-op, we handle blur via click
      });
    }

    function renderGotoPortal(query) {
      const portal = ensureGotoPortal();
      const q = (query || '').toLowerCase().trim();
      let filtered = window._gotoData || [];
      if (q) {
        filtered = filtered.filter(o => o.search.includes(q));
      }
      if (!filtered.length) {
        if ((window._gotoData || []).length === 0) {
          portal.innerHTML = '<div style="padding:12px;color:#64748b;font-size:0.82rem;">No days/classes yet. Add days and classes first.</div>';
        } else {
          portal.innerHTML = '<div style="padding:12px;color:#64748b;font-size:0.82rem;">No matches for "' + escapeHtml(query||'') + '"</div>';
        }
        portal.scrollTop = 0;
        return;
      }
      let html = '';
      let lastGroup = null;
      filtered.forEach(item => {
        if (item.group !== lastGroup) {
          html += '<div class="goto-group">' + escapeHtml(item.group) + '</div>';
          lastGroup = item.group;
        }
        html += '<div class="goto-opt" data-row="' + item.rowId + '" data-label="' + escapeHtml(item.label) + '">' + escapeHtml(item.label) + '</div>';
      });
      portal.innerHTML = html;
      portal.scrollTop = 0;
    }

    function openGotoPortal() {
      const portal = ensureGotoPortal();
      const input = document.getElementById('gotoInput');
      if (!portal || !input) return;
      const rect = input.getBoundingClientRect();
      const vw = window.innerWidth;
      let left = rect.left;
      let width = Math.max(rect.width, 200);
      if (left + width > vw - 8) left = Math.max(8, vw - 8 - width);
      portal.style.left = left + 'px';
      portal.style.top = (rect.bottom + 6) + 'px';
      portal.style.width = width + 'px';
      portal.style.display = 'block';
      portal.style.maxHeight = '280px';
      portal.style.overflowY = 'auto';
      portal.style.overflowX = 'hidden';
      portal.style.pointerEvents = 'auto';
      highlightGoto(0);
    }

    function closeGotoPortal() {
      const portal = document.getElementById('gotoPortal');
      if (portal) portal.style.display = 'none';
    }

    function highlightGoto(idx) {
      const portal = document.getElementById('gotoPortal');
      if (!portal) return;
      const opts = portal.querySelectorAll('.goto-opt');
      opts.forEach((el,i) => el.classList.toggle('highlight', i===idx));
      if (opts[idx]) {
        const optTop = opts[idx].offsetTop;
        const optBottom = optTop + opts[idx].offsetHeight;
        if (optTop < portal.scrollTop) portal.scrollTop = optTop;
        else if (optBottom > portal.scrollTop + portal.clientHeight) portal.scrollTop = optBottom - portal.clientHeight;
      }
    }

    function jumpToDayClass(rowId) {
      if (!rowId) return;
      const row = document.getElementById(rowId);
      const compareSchoolTable = document.getElementById('compareSchoolTable');
      let targetRow = row;
      if (!targetRow && compareSchoolTable) {
        try { targetRow = compareSchoolTable.querySelector('#' + CSS.escape(rowId)); } catch(e) { targetRow = document.getElementById(rowId); }
      }
      // Fallback: search by id without CSS.escape
      if (!targetRow) targetRow = document.getElementById(rowId);
      if (!targetRow) { showToast('Row not found: ' + rowId); return; }
      const compareContainer = document.querySelector('.compare-pane-school .compare-scroll');
      const container = document.querySelector('.timetable-wrapper');
      const activeContainer = (state.currentView === 'compare' && compareContainer) ? compareContainer : container;
      if (activeContainer) {
        const top = targetRow.getBoundingClientRect().top - activeContainer.getBoundingClientRect().top + activeContainer.scrollTop - 10;
        activeContainer.scrollTo({ top: top, behavior: 'smooth' });
      } else {
        targetRow.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      targetRow.classList.remove('row-highlight-flash');
      void targetRow.offsetWidth;
      targetRow.classList.add('row-highlight-flash');
      const cells = targetRow.querySelectorAll('.day-cell, .class-cell');
      cells.forEach(c => { const orig = c.style.background; c.style.background = '#fef08a'; setTimeout(() => { c.style.background = orig; }, 1600); });
      setTimeout(() => targetRow.classList.remove('row-highlight-flash'), 2000);
    }

// ========== ZOOM ==========

    state.zoom = 1; // reset safe default; applyZoom normalizes

    function normalizeZoom(z) {
      const n = Number(z);
      if (!isFinite(n) || n < 0.5 || n > 1.75) return 1;
      return Math.round(n * 10) / 10;
    }

    function applyZoom() {
      state.zoom = normalizeZoom(state.zoom);
      const el = document.getElementById('timetableScale');
      const label = document.getElementById('zoomLevel');
      if (label) label.textContent = Math.round(state.zoom * 100) + '%';
      if (!el) return;

      // transform only when not 100% — at 100% clear it so sticky header freeze works
      el.style.zoom = '';
      if (state.zoom === 1) {
        el.style.transform = '';
        el.style.width = '';
      } else {
        el.style.transform = 'scale(' + state.zoom + ')';
        el.style.width = (100 / state.zoom) + '%';
      }
    }

    function zoomIn() {
      state.zoom = normalizeZoom((state.zoom || 1) + 0.1);
      if (state.zoom > 1.75) state.zoom = 1.75;
      applyZoom();
    }
    function zoomOut() {
      state.zoom = normalizeZoom((state.zoom || 1) - 0.1);
      if (state.zoom < 0.5) state.zoom = 0.5;
      applyZoom();
    }
    function zoomReset() {
      state.zoom = 1;
      applyZoom();
    }

    // ========== AUTOGENERATE ==========
    function ensureAutoGenRules() {
      if (!state.autoGenRules || typeof state.autoGenRules !== 'object') {
        state.autoGenRules = { subjectGroups: [], syncBlocks: [], noDoubleSubjects: [], forceDoubleSubjects: [], teacherBlocks: [] };
      }
      const r = state.autoGenRules;
      if (!Array.isArray(r.subjectGroups)) r.subjectGroups = [];
      if (!Array.isArray(r.syncBlocks)) r.syncBlocks = [];
      if (!Array.isArray(r.noDoubleSubjects)) r.noDoubleSubjects = [];
      if (!Array.isArray(r.forceDoubleSubjects)) r.forceDoubleSubjects = [];
      if (!Array.isArray(r.teacherBlocks)) r.teacherBlocks = [];
      // null = all subjects; array = only those ids
      if (r.includeSubjectIds != null && !Array.isArray(r.includeSubjectIds)) r.includeSubjectIds = null;
      return r;
    }

    function agGetIncludedSubjectIds() {
      const r = ensureAutoGenRules();
      if (r.includeSubjectIds == null) {
        return state.subjects.map(s => s.id);
      }
      return r.includeSubjectIds.slice();
    }

    function isSubjectIncludedInAutoGen(subjectId) {
      const r = ensureAutoGenRules();
      if (r.includeSubjectIds == null) return true;
      return r.includeSubjectIds.indexOf(subjectId) >= 0;
    }

    function agSelectAllSubjects() {
      ensureAutoGenRules().includeSubjectIds = null; // null means all
      renderAutoGenRulesUI();
    }

    function agSelectNoSubjects() {
      ensureAutoGenRules().includeSubjectIds = [];
      renderAutoGenRulesUI();
    }

    function agToggleIncludeSubject(sid) {
      agRememberClick('include', '', sid);
      const r = ensureAutoGenRules();
      if (r.includeSubjectIds == null) {
        // Was "all" — start from all minus this one
        r.includeSubjectIds = state.subjects.map(s => s.id).filter(id => id !== sid);
      } else {
        const i = r.includeSubjectIds.indexOf(sid);
        if (i >= 0) r.includeSubjectIds.splice(i, 1);
        else r.includeSubjectIds.push(sid);
        // If every subject selected, store null (= all)
        if (r.includeSubjectIds.length === state.subjects.length &&
            state.subjects.every(s => r.includeSubjectIds.indexOf(s.id) >= 0)) {
          r.includeSubjectIds = null;
        }
      }
      renderAutoGenRulesUI();
    }

    function agInvertSubjects(){
      const r = ensureAutoGenRules();
      const allIds = state.subjects.map(s=>s.id);
      const selected = r.includeSubjectIds==null ? allIds.slice() : r.includeSubjectIds.slice();
      const inverted = allIds.filter(id=> selected.indexOf(id)<0);
      r.includeSubjectIds = inverted.length===0 ? [] : (inverted.length===allIds.length ? null : inverted);
      renderAutoGenRulesUI();
    }
    function agSelectCoreSubjects(){
      // Core = subjects offered in >50% of classes or with name containing core keywords
      const coreKeywords = ['english','mathematics','maths','math','basic science','basic tech','civic','computer'];
      const coreIds = state.subjects.filter(s=>{
        const nameLow = (s.name||'').toLowerCase();
        const isKeyword = coreKeywords.some(k=> nameLow.includes(k));
        // also check if offered in many classes
        let offeredCount = 0;
        (state.classes||[]).forEach(c=>{
          const w = (typeof getWeeklyFor==='function')? getWeeklyFor(s.id, c.id):0;
          if (w>0) offeredCount++;
        });
        return isKeyword || offeredCount >= Math.ceil((state.classes.length||1)/2);
      }).map(s=>s.id);
      const r = ensureAutoGenRules();
      r.includeSubjectIds = coreIds.length===state.subjects.length ? null : coreIds;
      renderAutoGenRulesUI();
    }
    function agSelectByClassFilter(){
      const classFilterEl = document.getElementById('agClassFilter');
      if (!classFilterEl || !classFilterEl.value) { showToast('Select a class filter first'); return; }
      const classId = classFilterEl.value;
      const idsForClass = state.subjects.filter(s=>{
        const w = (typeof getWeeklyFor==='function')? getWeeklyFor(s.id, classId):0;
        return w>0;
      }).map(s=>s.id);
      const r = ensureAutoGenRules();
      // merge with existing or replace? replace with class-specific
      r.includeSubjectIds = idsForClass.length===state.subjects.length ? null : idsForClass;
      renderAutoGenRulesUI();
      showToast('Selected '+idsForClass.length+' subjects offered for '+ (state.classes.find(c=>c.id===classId)?.name||'class'));
    }
    function agFilterSubjects(){
      const inclEl = document.getElementById('agIncludeSubjectsList');
      const searchEl = document.getElementById('agSubjectSearch');
      const teacherFilterEl = null;
      const classFilterEl = null;
      if (!inclEl) return;
      const q = (searchEl?.value||'').toLowerCase().trim();
      const teacherF = (teacherFilterEl?.value||'').toLowerCase().trim();
      const classF = classFilterEl?.value||'';
      const allSubjects = window._agAllSubjectsCache || state.subjects.slice();
      const selected = window._agSelectedCache || (ensureAutoGenRules().includeSubjectIds==null ? allSubjects.map(s=>s.id) : ensureAutoGenRules().includeSubjectIds);
      // Update cache
      window._agSelectedCache = selected.slice();

      let filtered = allSubjects.filter(s=>{
        const nameLow = (s.name||'').toLowerCase();
        const teacherLow = (s.teacher||'').toLowerCase();
        if (q && !(nameLow.includes(q) || teacherLow.includes(q))) return false;
        if (teacherF && teacherLow !== teacherF) return false;
        if (classF) {
          const w = (typeof getWeeklyFor==='function')? getWeeklyFor(s.id, classF):0;
          if (w<=0) return false;
        }
        return true;
      });

      if (!filtered.length) {
        inclEl.innerHTML = '<p style="font-size:0.75rem;color:#94a3b8;padding:12px;text-align:center;">No subjects match filter</p>';
        return;
      }

      inclEl.innerHTML = filtered.map(s=>{
        const on = selected.indexOf(s.id)>=0;
        const totalWeekly = (state.classes||[]).reduce((sum,c)=> sum + (typeof getWeeklyFor==='function'?getWeeklyFor(s.id,c.id):0), 0);
        const offeredIn = (state.classes||[]).filter(c=> (typeof getWeeklyFor==='function'?getWeeklyFor(s.id,c.id):0)>0).length;
        return '<label style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-bottom:1px solid #f1f5f9;cursor:pointer;'+(on?'background:#eef2ff;':'')+'" title="'+escapeHtml(s.name)+' - '+escapeHtml(s.teacher||'')+' - '+totalWeekly+' periods/week across '+offeredIn+' classes">'
          + '<input type="checkbox" '+(on?'checked':'')+' onchange="agToggleIncludeSubject(\''+s.id+'\')" style="width:16px;height:16px;accent-color:#4f46e5;" />'
          + '<span style="width:12px;height:12px;border-radius:50%;background:'+ (s.color||'#64748b') +';display:inline-block;flex-shrink:0;"></span>'
          + '<span style="flex:1;font-size:0.82rem;line-height:1.2;"><span style="font-weight:600;">'+escapeHtml(s.name)+'</span> <span style="color:#64748b;font-size:0.75rem;">('+escapeHtml(s.teacher||'?')+')</span></span>'
          + '<span style="font-size:0.68rem;color:#475569;background:#f1f5f9;padding:2px 6px;border-radius:10px;white-space:nowrap;">'+totalWeekly+'× · '+offeredIn+' cls</span>'
          + '</label>';
      }).join('');
    }


    function agUid() {
      return 'ag' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    }

    function openAutoGenModal() {
      if (!state.classes.length) { showToast('Add classes first'); return; }
      if (!state.subjects.length) { showToast('Add subjects first'); return; }
      if (!state.slots.filter(s => !s.isBreak).length) { showToast('Add teaching periods first'); return; }
      ensureAutoGenRules();
      renderAutoGenRulesUI();
      document.getElementById('autoGenModal').classList.add('open');
    }

    function closeAutoGenModal() {
      const modal = document.getElementById('autoGenModal');
      if (modal) modal.classList.remove('open');
      // Rules stay saved; only generation is skipped
    }

    function renderAutoGenRulesUI() {
      const r = ensureAutoGenRules();
      // Keep scroll position when toggling chips (subject / class)
      const scrollEl = document.getElementById('agModalScroll');
      const savedScroll = scrollEl ? scrollEl.scrollTop : 0;

      // Subjects to generate - IMPROVED UI
      const inclEl = document.getElementById('agIncludeSubjectsList');
      const badgeEl = document.getElementById('agSubjectCountBadge');
      const teacherFilterEl = null;
      const classFilterEl = null;
      if (teacherFilterEl && teacherFilterEl.options.length<=1) {
        const teachers = [...new Set(state.subjects.map(s=> (s.teacher||'').trim()).filter(Boolean))].sort();
        teacherFilterEl.innerHTML = '<option value="">All teachers</option>' + teachers.map(t=> '<option value="'+escapeHtml(t)+'">'+escapeHtml(t)+'</option>').join('');
      }
      if (classFilterEl && classFilterEl.options.length<=1) {
        classFilterEl.innerHTML = '<option value="">All classes</option>' + (state.classes||[]).map(c=> '<option value="'+escapeHtml(c.id)+'">'+escapeHtml(c.name)+'</option>').join('');
      }
      if (inclEl) {
        if (!state.subjects.length) {
          inclEl.innerHTML = '<p style="font-size:0.75rem;color:var(--muted);margin:0;padding:8px;">Add subjects first.</p>';
          if (badgeEl) badgeEl.textContent = '0/0';
        } else {
          const selected = r.includeSubjectIds == null ? state.subjects.map(s => s.id) : r.includeSubjectIds;
          if (badgeEl) badgeEl.textContent = selected.length + ' / ' + state.subjects.length + ' selected';
          // store for filter function
          window._agAllSubjectsCache = state.subjects.slice();
          window._agSelectedCache = selected.slice();
          // initial render with filter
          if (typeof agFilterSubjects === 'function') agFilterSubjects();
          else {
            // fallback simple list
            inclEl.innerHTML = state.subjects.map(s=>{
              const on = selected.indexOf(s.id)>=0;
              const totalWeekly = (state.classes||[]).reduce((sum,c)=> sum + (typeof getWeeklyFor==='function'?getWeeklyFor(s.id,c.id):0), 0);
              return '<label style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-bottom:1px solid #f1f5f9;cursor:pointer;"><input type="checkbox" '+(on?'checked':'')+' onchange="agToggleIncludeSubject(\''+s.id+'\')" style="width:16px;height:16px;" /> <span style="width:10px;height:10px;border-radius:50%;background:'+ (s.color||'#64748b') +';display:inline-block;"></span> <span style="flex:1;font-size:0.82rem;">'+escapeHtml(s.name)+' <span style="color:#64748b;">('+escapeHtml(s.teacher||'?')+')</span></span> <span style="font-size:0.7rem;color:#64748b;">'+totalWeekly+'×/week</span></label>';
            }).join('');
          }
        }
      }
      // Subject groups
      const gEl = document.getElementById('agSubjectGroupsList');
      if (gEl) {
        if (!r.subjectGroups.length) {
          gEl.innerHTML = '<p style="font-size:0.75rem;color:var(--muted);margin:0;">No groups yet.</p>';
        } else {
          gEl.innerHTML = r.subjectGroups.map((g, i) => agRenderSubjectGroupRow(g, i + 1)).join('');
        }
      }
      // Sync blocks
      const sEl = document.getElementById('agSyncBlocksList');
      if (sEl) {
        if (!r.syncBlocks.length) {
          sEl.innerHTML = '<p style="font-size:0.75rem;color:var(--muted);margin:0;">No same-period rules yet.</p>';
        } else {
          sEl.innerHTML = r.syncBlocks.map((b, i) => agRenderSyncBlockRow(b, i + 1)).join('');
        }
      }
      // Force double for 2/week
      const fEl = document.getElementById('agForceDoubleList');
      if (fEl) {
        if (!state.subjects.length) {
          fEl.innerHTML = '<p style="font-size:0.75rem;color:var(--muted);margin:0;">Add subjects first.</p>';
        } else {
          fEl.innerHTML = '<div class="ag-chips">' + state.subjects.map(s => {
            const on = r.forceDoubleSubjects.indexOf(s.id) >= 0 ? ' on' : '';
            return '<span class="ag-chip' + on + '" onclick="agToggleForceDouble(\'' + s.id + '\')">' +
              escapeHtml(agSubjectLabel(s)) + '</span>';
          }).join('') + '</div>' +
            '<p style="font-size:0.7rem;color:var(--muted);margin:4px 0 0;">Highlighted = must be one double period when weekly load is 2.</p>';
        }
      }
      // No double
      const nEl = document.getElementById('agNoDoubleList');
      if (nEl) {
        if (!state.subjects.length) {
          nEl.innerHTML = '<p style="font-size:0.75rem;color:var(--muted);margin:0;">Add subjects first.</p>';
        } else {
          nEl.innerHTML = '<div class="ag-chips">' + state.subjects.map(s => {
            const on = r.noDoubleSubjects.indexOf(s.id) >= 0 ? ' on' : '';
            return '<span class="ag-chip' + on + '" onclick="agToggleNoDouble(\'' + s.id + '\')">' +
              escapeHtml(agSubjectLabel(s)) + '</span>';
          }).join('') + '</div>' +
            '<p style="font-size:0.7rem;color:var(--muted);margin:4px 0 0;">Highlighted = never force a double period.</p>';
        }
      }
      // Teacher blocks
      const tEl = document.getElementById('agTeacherBlocksList');
      if (tEl) {
        if (!r.teacherBlocks.length) {
          tEl.innerHTML = '<p style="font-size:0.75rem;color:var(--muted);margin:0;">No teacher blocks yet.</p>';
        } else {
          tEl.innerHTML = r.teacherBlocks.map((b, i) => agRenderTeacherBlockRow(b, i + 1)).join('');
        }
      }

      // Restore scroll so chip clicks don't jump to the top
      if (scrollEl) {
        scrollEl.scrollTop = savedScroll;
        requestAnimationFrame(function () {
          const el = document.getElementById('agModalScroll');
          if (el) el.scrollTop = savedScroll;
          agRestoreClickFocus();
        });
      }
    }

    function agSubjectLabel(s) {
      const t = (s.teacher || '').trim();
      return t ? (s.name + ' · ' + t) : s.name;
    }

    /** Classes where this subject has weekly load > 0 (classes the teacher teaches it to) */
    function agClassesForSubject(subjectId) {
      return state.classes
        .filter(c => getWeeklyFor(subjectId, c.id) > 0)
        .map(c => c.id);
    }

    /**
     * When selecting subjects, set classIds to classes offered by those subjects
     * (union). Empty subject list → clear classes.
     */
    function agSyncClassesFromSubjects(subjectIds) {
      if (!subjectIds || !subjectIds.length) return [];
      const set = {};
      subjectIds.forEach(sid => {
        agClassesForSubject(sid).forEach(cid => { set[cid] = true; });
      });
      return Object.keys(set);
    }

    function agChipSet(items, selectedIds, kind, onToggleFn, rowId) {
      return items.map(it => {
        const on = selectedIds.indexOf(it.id) >= 0 ? ' on' : '';
        return '<span class="ag-chip ' + kind + on + '" data-id="' + escapeHtml(it.id) + '" data-row="' + escapeHtml(rowId || '') + '" ' +
          'onclick="' + onToggleFn + '(\'' + rowId + '\',\'' + it.id + '\')">' + escapeHtml(it.label) + '</span>';
      }).join('');
    }

    /** Class chips only for classes taught by the selected subject(s)' teacher(s) */
    function agClassChipsForSubjects(subjectIds) {
      const ids = agSyncClassesFromSubjects(subjectIds || []);
      if (!ids.length) return [];
      return ids.map(cid => {
        const c = state.classes.find(x => x.id === cid);
        return c ? { id: c.id, label: c.name } : null;
      }).filter(Boolean);
    }

    function agRememberClick(kind, rowId, itemId) {
      window._agLastClick = { kind: kind || '', rowId: rowId || '', itemId: itemId || '' };
    }

    function agRestoreClickFocus() {
      const info = window._agLastClick;
      const scrollEl = document.getElementById('agModalScroll');
      if (!info || !scrollEl) return;
      let chip = null;
      if (info.itemId) {
        chip = scrollEl.querySelector('.ag-chip[data-id="' + info.itemId + '"][data-row="' + info.rowId + '"]') ||
               scrollEl.querySelector('.ag-chip[data-id="' + info.itemId + '"]');
      }
      if (chip && typeof chip.scrollIntoView === 'function') {
        chip.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    }

    function agRenderSubjectGroupRow(g, num) {
      const subChips = state.subjects.map(s => ({ id: s.id, label: agSubjectLabel(s) }));
      const classChips = agClassChipsForSubjects(g.subjectIds || []);
      // Drop classIds that are no longer relevant
      if (g.classIds && g.classIds.length) {
        const allowed = classChips.map(c => c.id);
        g.classIds = g.classIds.filter(id => allowed.indexOf(id) >= 0);
      }
      const classHtml = classChips.length
        ? agChipSet(classChips, g.classIds || [], '', 'agToggleGroupClass', g.id)
        : '<span style="font-size:0.72rem;color:var(--muted);">Select a subject to list its classes</span>';
      return '<div class="ag-rule-row" data-gid="' + g.id + '">' +
        '<div class="ag-row-top">' +
        '<span class="subj-num" title="Group #' + num + '">' + num + '</span>' +
        '<input type="text" value="' + escapeHtml(g.name || '') + '" placeholder="Group name" ' +
        'onchange="agUpdateGroupName(\'' + g.id + '\', this.value)" style="margin:0;flex:1;" />' +
        '<button type="button" class="btn btn-danger btn-sm" onclick="agRemoveSubjectGroup(\'' + g.id + '\')">Remove</button></div>' +
        '<label>Subjects (shows teacher)</label><div class="ag-chips">' +
        agChipSet(subChips, g.subjectIds || [], '', 'agToggleGroupSubject', g.id) + '</div>' +
        '<label>Classes for selected teacher/subject</label><div class="ag-chips">' +
        classHtml + '</div></div>';
    }

    function agRenderSyncBlockRow(b, num) {
      const subChips = state.subjects.map(s => ({ id: s.id, label: agSubjectLabel(s) }));
      const classChips = agClassChipsForSubjects(b.subjectIds || []);
      if (b.classIds && b.classIds.length) {
        const allowed = classChips.map(c => c.id);
        b.classIds = b.classIds.filter(id => allowed.indexOf(id) >= 0);
      }
      const classHtml = classChips.length
        ? agChipSet(classChips, b.classIds || [], '', 'agToggleSyncClass', b.id)
        : '<span style="font-size:0.72rem;color:var(--muted);">Select a subject to list its classes / arms</span>';
      const groups = ensureAutoGenRules().subjectGroups;
      const groupOpts = '<option value="">— Subjects below —</option>' +
        groups.map(g => '<option value="' + g.id + '"' + (b.useGroupId === g.id ? ' selected' : '') + '>' +
          escapeHtml(g.name || 'Group') + '</option>').join('');
      return '<div class="ag-rule-row">' +
        '<div class="ag-row-top">' +
        '<span class="subj-num" title="Rule #' + num + '">' + num + '</span>' +
        '<span style="font-weight:600;flex:1;">Same-period rule #' + num + '</span>' +
        '<button type="button" class="btn btn-danger btn-sm" onclick="agRemoveSyncBlock(\'' + b.id + '\')">Remove</button></div>' +
        '<label>Or use a subject group</label>' +
        '<select onchange="agUpdateSyncGroup(\'' + b.id + '\', this.value)">' + groupOpts + '</select>' +
        '<label>Subjects (shows teacher)</label><div class="ag-chips">' +
        agChipSet(subChips, b.subjectIds || [], '', 'agToggleSyncSubject', b.id) + '</div>' +
        '<label>Classes / arms for selected teacher</label><div class="ag-chips">' +
        classHtml + '</div></div>';
    }

    function agRenderTeacherBlockRow(b, num) {
      const teachers = getUniqueTeachers();
      const tOpts = '<option value="">— Teacher —</option>' +
        teachers.map(t => '<option value="' + escapeHtml(t) + '"' + (b.teacher === t ? ' selected' : '') + '>' +
          escapeHtml(t) + '</option>').join('');
      const dayChips = (state.days || []).map(d => ({ id: d, label: d }));
      const slotChips = state.slots.filter(s => !s.isBreak).map(s => ({ id: s.id, label: s.label }));
      return '<div class="ag-rule-row">' +
        '<div class="ag-row-top">' +
        '<span class="subj-num" title="Block #' + num + '">' + num + '</span>' +
        '<select onchange="agUpdateTeacherBlockTeacher(\'' + b.id + '\', this.value)" style="margin:0;flex:1;">' +
        tOpts + '</select>' +
        '<button type="button" class="btn btn-danger btn-sm" onclick="agRemoveTeacherBlock(\'' + b.id + '\')">Remove</button></div>' +
        '<label>Days blocked (none = all days)</label><div class="ag-chips">' +
        agChipSet(dayChips, b.days || [], 'day-chip', 'agToggleTeacherDay', b.id) + '</div>' +
        '<label>Periods blocked (none = all periods on selected days)</label><div class="ag-chips">' +
        agChipSet(slotChips, b.slotIds || [], 'slot-chip', 'agToggleTeacherSlot', b.id) + '</div></div>';
    }

    function agAddSubjectGroup() {
      const r = ensureAutoGenRules();
      r.subjectGroups.unshift({
        id: agUid(), name: 'Group ' + (r.subjectGroups.length + 1),
        subjectIds: [], classIds: []
      });
      renderAutoGenRulesUI();
    }
    function agRemoveSubjectGroup(id) {
      const r = ensureAutoGenRules();
      r.subjectGroups = r.subjectGroups.filter(g => g.id !== id);
      renderAutoGenRulesUI();
    }
    function agUpdateGroupName(id, name) {
      const g = ensureAutoGenRules().subjectGroups.find(x => x.id === id);
      if (g) g.name = name;
    }
    function agToggleGroupSubject(gid, sid) {
      agRememberClick('groupSubject', gid, sid);
      const g = ensureAutoGenRules().subjectGroups.find(x => x.id === gid);
      if (!g) return;
      const i = g.subjectIds.indexOf(sid);
      if (i >= 0) {
        g.subjectIds.splice(i, 1);
        g.classIds = agSyncClassesFromSubjects(g.subjectIds);
      } else {
        if (!g.subjectIds.length) g.subjectIds = [sid];
        else g.subjectIds.push(sid);
        g.classIds = agClassesForSubject(sid);
      }
      renderAutoGenRulesUI();
    }
    function agToggleGroupClass(gid, cid) {
      agRememberClick('groupClass', gid, cid);
      const g = ensureAutoGenRules().subjectGroups.find(x => x.id === gid);
      if (!g) return;
      const i = g.classIds.indexOf(cid);
      if (i >= 0) g.classIds.splice(i, 1); else g.classIds.push(cid);
      renderAutoGenRulesUI();
    }

    function agAddSyncBlock() {
      ensureAutoGenRules().syncBlocks.unshift({
        id: agUid(), subjectIds: [], classIds: [], useGroupId: ''
      });
      renderAutoGenRulesUI();
    }
    function agRemoveSyncBlock(id) {
      const r = ensureAutoGenRules();
      r.syncBlocks = r.syncBlocks.filter(b => b.id !== id);
      renderAutoGenRulesUI();
    }
    function agUpdateSyncGroup(id, gid) {
      const b = ensureAutoGenRules().syncBlocks.find(x => x.id === id);
      if (!b) return;
      b.useGroupId = gid || '';
      if (gid) {
        const g = ensureAutoGenRules().subjectGroups.find(x => x.id === gid);
        if (g) {
          b.subjectIds = (g.subjectIds || []).slice();
          b.classIds = (g.classIds || []).slice();
          if (!b.classIds.length && b.subjectIds.length) {
            b.classIds = agSyncClassesFromSubjects(b.subjectIds);
          }
        }
      }
      renderAutoGenRulesUI();
    }
    function agToggleSyncSubject(bid, sid) {
      agRememberClick('syncSubject', bid, sid);
      const b = ensureAutoGenRules().syncBlocks.find(x => x.id === bid);
      if (!b) return;
      const i = b.subjectIds.indexOf(sid);
      if (i >= 0) {
        b.subjectIds.splice(i, 1);
        b.classIds = agSyncClassesFromSubjects(b.subjectIds);
      } else {
        b.subjectIds = [sid];
        b.classIds = agClassesForSubject(sid);
        b.useGroupId = '';
      }
      renderAutoGenRulesUI();
    }
    function agToggleSyncClass(bid, cid) {
      agRememberClick('syncClass', bid, cid);
      const b = ensureAutoGenRules().syncBlocks.find(x => x.id === bid);
      if (!b) return;
      const i = b.classIds.indexOf(cid);
      if (i >= 0) b.classIds.splice(i, 1); else b.classIds.push(cid);
      renderAutoGenRulesUI();
    }

    function agToggleForceDouble(sid) {
      const r = ensureAutoGenRules();
      const i = r.forceDoubleSubjects.indexOf(sid);
      if (i >= 0) {
        r.forceDoubleSubjects.splice(i, 1);
      } else {
        r.forceDoubleSubjects.push(sid);
        // Cannot both force and forbid double
        const j = r.noDoubleSubjects.indexOf(sid);
        if (j >= 0) r.noDoubleSubjects.splice(j, 1);
      }
      renderAutoGenRulesUI();
    }
    function agToggleNoDouble(sid) {
      const r = ensureAutoGenRules();
      const i = r.noDoubleSubjects.indexOf(sid);
      if (i >= 0) {
        r.noDoubleSubjects.splice(i, 1);
      } else {
        r.noDoubleSubjects.push(sid);
        const j = r.forceDoubleSubjects.indexOf(sid);
        if (j >= 0) r.forceDoubleSubjects.splice(j, 1);
      }
      renderAutoGenRulesUI();
    }
    function subjectForcesDouble(subjectId) {
      return (ensureAutoGenRules().forceDoubleSubjects || []).indexOf(subjectId) >= 0;
    }

    function agAddTeacherBlock() {
      ensureAutoGenRules().teacherBlocks.unshift({
        id: agUid(), teacher: getUniqueTeachers()[0] || '', days: [], slotIds: []
      });
      renderAutoGenRulesUI();
    }
    function agRemoveTeacherBlock(id) {
      const r = ensureAutoGenRules();
      r.teacherBlocks = r.teacherBlocks.filter(b => b.id !== id);
      renderAutoGenRulesUI();
    }
    function agUpdateTeacherBlockTeacher(id, teacher) {
      const b = ensureAutoGenRules().teacherBlocks.find(x => x.id === id);
      if (b) b.teacher = teacher;
    }
    function agToggleTeacherDay(bid, day) {
      const b = ensureAutoGenRules().teacherBlocks.find(x => x.id === bid);
      if (!b) return;
      const i = b.days.indexOf(day);
      if (i >= 0) b.days.splice(i, 1); else b.days.push(day);
      renderAutoGenRulesUI();
    }
    function agToggleTeacherSlot(bid, slotId) {
      const b = ensureAutoGenRules().teacherBlocks.find(x => x.id === bid);
      if (!b) return;
      const i = b.slotIds.indexOf(slotId);
      if (i >= 0) b.slotIds.splice(i, 1); else b.slotIds.push(slotId);
      renderAutoGenRulesUI();
    }

    /** Teacher blocked by rule 4? (incomplete rules with no day and no period = ignore) */
    function isTeacherBlockedAt(teacher, day, slotId) {
      if (!teacher) return false;
      const blocks = ensureAutoGenRules().teacherBlocks || [];
      const tKey = String(teacher).trim().toLowerCase();
      for (const b of blocks) {
        if (!b.teacher || String(b.teacher).trim().toLowerCase() !== tKey) continue;
        if (!b.days.length && !b.slotIds.length) continue; // not configured yet
        const dayHit = !b.days.length || b.days.indexOf(day) >= 0;
        const slotHit = !b.slotIds.length || b.slotIds.indexOf(slotId) >= 0;
        if (dayHit && slotHit) return true;
      }
      return false;
    }

    /** Subjects that should skip forced double periods */
    function subjectSkipsDouble(subjectId) {
      return (ensureAutoGenRules().noDoubleSubjects || []).indexOf(subjectId) >= 0;
    }

    /** Resolve subject ids for a sync block */
    function getSyncBlockSubjects(block) {
      let ids = [];
      if (block.useGroupId) {
        const g = ensureAutoGenRules().subjectGroups.find(x => x.id === block.useGroupId);
        if (g && g.subjectIds && g.subjectIds.length) ids = g.subjectIds.slice();
      } else {
        ids = (block.subjectIds || []).slice();
      }
      return ids.filter(isSubjectIncludedInAutoGen);
    }

    /**
     * Strip assignments that violate autogenerate rules so those rules can be forced.
     * Returns number of cells removed.
     */
    function forceAutoGenRulesCompliance() {
      const rules = ensureAutoGenRules();
      let removed = 0;
      const before = state.assignments.length;

      // Rule 4: remove any period where the teacher is blocked (never remove locked)
      state.assignments = state.assignments.filter(a => {
        if (assignmentIsLocked(a)) return true;
        const subj = state.subjects.find(s => s.id === a.subjectId);
        if (!subj || !subj.teacher) return true;
        if (isTeacherBlockedAt(subj.teacher, a.day, a.slotId)) {
          removed++;
          return false;
        }
        return true;
      });

      // Rule 3: break forced double periods for "no double" subjects
      // (remove one half of each consecutive pair so they are not doubles)
      (rules.noDoubleSubjects || []).forEach(subjectId => {
        state.classes.forEach(cls => {
          while (subjectHasDoublePeriod(subjectId, cls.id)) {
            // Find one consecutive pair and drop the later period
            const teachingIds = state.slots.filter(s => !s.isBreak).map(s => s.id);
            let dropped = false;
            for (const day of state.days) {
              const onDay = state.assignments
                .filter(a => a.day === day && a.subjectId === subjectId && a.classId === cls.id)
                .map(a => a.slotId);
              for (let i = 0; i < teachingIds.length - 1; i++) {
                if (onDay.indexOf(teachingIds[i]) >= 0 && onDay.indexOf(teachingIds[i + 1]) >= 0 &&
                    slotsAreConsecutive(teachingIds[i], teachingIds[i + 1])) {
                  const dropId = teachingIds[i + 1];
                  const victim = state.assignments.find(a =>
                    a.day === day && a.slotId === dropId && a.subjectId === subjectId && a.classId === cls.id
                  );
                  if (victim && assignmentIsLocked(victim)) break;
                  state.assignments = state.assignments.filter(a =>
                    !(a.day === day && a.slotId === dropId && a.subjectId === subjectId && a.classId === cls.id && !assignmentIsLocked(a))
                  );
                  removed++;
                  dropped = true;
                  break;
                }
              }
              if (dropped) break;
            }
            if (!dropped) break;
          }
        });
      });

      // Rule 2: same-period arms — clear subject placements that are not aligned across arms
      (rules.syncBlocks || []).forEach(block => {
        let classIds = (block.classIds || []).filter(Boolean);
        if (block.useGroupId) {
          const g = rules.subjectGroups.find(x => x.id === block.useGroupId);
          if (g && g.classIds && g.classIds.length && classIds.length < 2) classIds = g.classIds.slice();
        }
        const subjectIds = getSyncBlockSubjects(block);
        if (classIds.length < 2 || !subjectIds.length) return;

        subjectIds.forEach(subjectId => {
          // Map day|slotId → set of classIds that have this subject there
          const map = {};
          state.assignments.forEach(a => {
            if (a.subjectId !== subjectId || classIds.indexOf(a.classId) < 0) return;
            const key = a.day + '|' + a.slotId;
            if (!map[key]) map[key] = [];
            map[key].push(a.classId);
          });
          // Keep only fully synced slots (all active classes present); drop partials
          const active = classIds.filter(cid => getWeeklyFor(subjectId, cid) > 0);
          Object.keys(map).forEach(key => {
            const present = map[key];
            const needAll = active.filter(cid => {
              // only require classes that still "use" this subject
              return getWeeklyFor(subjectId, cid) > 0;
            });
            const allSynced = needAll.every(cid => present.indexOf(cid) >= 0);
            if (!allSynced) {
              const [day, slotId] = key.split('|');
              const beforeLen = state.assignments.length;
              state.assignments = state.assignments.filter(a => {
                if (assignmentIsLocked(a)) return true;
                return !(a.day === day && a.slotId === slotId && a.subjectId === subjectId && classIds.indexOf(a.classId) >= 0);
              });
              removed += beforeLen - state.assignments.length;
            }
          });
          // Also clear remaining non-synced leftovers for these subject+classes so rule can re-place
          // (any assignment of this subject on these classes that is alone on its slot vs arms)
          // After partial drop, leftover singles may remain on different slots — clear all for re-force
          const still = state.assignments.filter(a =>
            a.subjectId === subjectId && classIds.indexOf(a.classId) >= 0
          );
          // Group by day|slot again
          const map2 = {};
          still.forEach(a => {
            const key = a.day + '|' + a.slotId;
            if (!map2[key]) map2[key] = [];
            map2[key].push(a);
          });
          const okKeys = {};
          Object.keys(map2).forEach(key => {
            const ids = map2[key].map(a => a.classId);
            const needAll = classIds.filter(cid => getWeeklyFor(subjectId, cid) > 0);
            if (needAll.every(cid => ids.indexOf(cid) >= 0)) okKeys[key] = true;
          });
          // Remove assignments for these classes+subject that are not on a fully synced key
          const beforeLen = state.assignments.length;
          state.assignments = state.assignments.filter(a => {
            if (assignmentIsLocked(a)) return true;
            if (a.subjectId !== subjectId || classIds.indexOf(a.classId) < 0) return true;
            const key = a.day + '|' + a.slotId;
            return !!okKeys[key];
          });
          removed += beforeLen - state.assignments.length;
        });
      });

      // Rule 1: subject groups — clear existing placements of group subjects for those classes
      // so the consecutive block can be forced on regenerate
      (rules.subjectGroups || []).forEach(g => {
        const classIds = g.classIds || [];
        const subjectIds = g.subjectIds || [];
        if (!classIds.length || subjectIds.length < 2) return;
        const beforeLen = state.assignments.length;
        state.assignments = state.assignments.filter(a => {
          if (assignmentIsLocked(a)) return true;
          if (classIds.indexOf(a.classId) < 0) return true;
          if (subjectIds.indexOf(a.subjectId) < 0) return true;
          // Keep only if they already form a consecutive same-day block covering ≥2 group subjects
          return false; // force re-place as block
        });
        removed += beforeLen - state.assignments.length;
      });

      return state.assignments.length < before ? (before - state.assignments.length) : removed;
    }

    /**
     * Find day+slot free for ALL given classes for this subject (same-period arms).
     * Teacher must be able to cover every arm (combined-arms allowed).
     */
    function findSyncSlotForClasses(classIds, subjectId, opts) {
      opts = opts || {};
      const teachingSlots = state.slots.filter(s => !s.isBreak);
      const subj = state.subjects.find(s => s.id === subjectId);
      if (!subj || !classIds.length) return null;
      const candidates = [];
      const daysOrder = state.days.slice();
      if (Math.random() < 0.4) shuffleArray(daysOrder);
      daysOrder.forEach(day => {
        teachingSlots.forEach(slot => {
          if (isJumatCell(day, slot)) return;
          if (isTeacherBlockedAt(subj.teacher, day, slot.id)) return;
          // Every class free + quota + same-day rule
          let ok = true;
          for (const cid of classIds) {
            if (getWeeklyFor(subjectId, cid) <= 0) continue;
            if (countSubjectForClass(subjectId, cid) >= getQuotaFor(subjectId, cid)) continue;
            if (state.assignments.some(a => a.day === day && a.slotId === slot.id && a.classId === cid)) {
              ok = false; break;
            }
            if (teacherBusyInSlot(subj.teacher, day, slot.id, cid, subj, null)) {
              ok = false; break;
            }
            const rule = checkSameDaySubjectRule(subjectId, cid, day, slot.id);
            if (!rule.ok) { ok = false; break; }
          }
          if (!ok) return;
          // Prefer slots free for as many listed classes as possible
          let freeCount = 0;
          classIds.forEach(cid => {
            if (getWeeklyFor(subjectId, cid) <= countSubjectForClass(subjectId, cid)) return;
            if (!state.assignments.some(a => a.day === day && a.slotId === slot.id && a.classId === cid)) freeCount++;
          });
          if (freeCount < 2 && classIds.length >= 2) return;
          const dayLoad = state.assignments.filter(a => a.day === day && classIds.indexOf(a.classId) >= 0).length;
          candidates.push({ day, slotId: slot.id, score: -freeCount * 50 + dayLoad * 5 + Math.random() * 8 });
        });
      });
      if (!candidates.length) return null;
      candidates.sort((a, b) => a.score - b.score);
      return candidates[0];
    }

    /**
     * Place subject-group members as a consecutive block on one day for a class.
     * Returns number of periods placed.
     */
    function placeSubjectGroupBlock(classId, subjectIds, opts) {
      let placed = 0;
      // Subjects still needing periods for this class (and selected for generate)
      const pending = (subjectIds || []).filter(sid => {
        if (!isSubjectIncludedInAutoGen(sid)) return false;
        const need = getWeeklyFor(sid, classId);
        return need > 0 && countSubjectForClass(sid, classId) < need;
      });
      if (pending.length < 1) return 0;

      const teachingSlots = state.slots.filter(s => !s.isBreak);
      // Try each day: find longest run of consecutive free slots
      const daysOrder = state.days.slice();
      shuffleArray(daysOrder);
      for (const day of daysOrder) {
        // Build free consecutive runs
        const freeFlags = teachingSlots.map(slot => {
          if (isJumatCell(day, slot)) return false;
          return !state.assignments.some(a => a.day === day && a.slotId === slot.id && a.classId === classId);
        });
        // Try to place as many pending subjects as possible in one run
        for (let start = 0; start < teachingSlots.length; start++) {
          if (!freeFlags[start]) continue;
          let end = start;
          while (end + 1 < teachingSlots.length && freeFlags[end + 1] &&
                 slotsAreConsecutive(teachingSlots[end].id, teachingSlots[end + 1].id)) {
            end++;
          }
          const runLen = end - start + 1;
          if (runLen < 1) continue;
          const toPlace = pending.slice(0, runLen);
          let allOk = true;
          const planned = [];
          for (let i = 0; i < toPlace.length; i++) {
            const sid = toPlace[i];
            const slot = teachingSlots[start + i];
            const subj = state.subjects.find(s => s.id === sid);
            if (!subj) { allOk = false; break; }
            if (isTeacherBlockedAt(subj.teacher, day, slot.id)) { allOk = false; break; }
            if (teacherBusyInSlot(subj.teacher, day, slot.id, classId, subj, null)) { allOk = false; break; }
            if (countSubjectForClass(sid, classId) >= getQuotaFor(sid, classId)) { allOk = false; break; }
            const rule = checkSameDaySubjectRule(sid, classId, day, slot.id);
            if (!rule.ok) { allOk = false; break; }
            planned.push({ day, slotId: slot.id, classId, subjectId: sid });
          }
          if (!allOk || !planned.length) continue;
          planned.forEach(p => {
            state.assignments.push({
              id: 'a' + Date.now() + Math.random().toString(36).slice(2, 7),
              day: p.day, slotId: p.slotId, classId: p.classId, subjectId: p.subjectId
            });
            placed++;
          });
          return placed; // one solid block this pass
        }
      }
      // Fallback: place remaining one-by-one with group preference
      pending.forEach(sid => {
        const need = getWeeklyFor(sid, classId);
        while (countSubjectForClass(sid, classId) < need) {
          const slot = findBestSlot(classId, sid, Object.assign({}, opts, { preferGroupSubjects: subjectIds }));
          if (!slot) break;
          const subj = state.subjects.find(s => s.id === sid);
          if (!subj) break;
          if (isTeacherBlockedAt(subj.teacher, slot.day, slot.slotId)) break;
          if (state.assignments.some(a => a.day === slot.day && a.slotId === slot.slotId && a.classId === classId)) break;
          state.assignments.push({
            id: 'a' + Date.now() + Math.random().toString(36).slice(2, 7),
            day: slot.day, slotId: slot.slotId, classId, subjectId: sid
          });
          placed++;
        }
      });
      return placed;
    }

    /** Summary of what Generate will attempt (no changes applied). */
    function buildAutoGenPreview(opts, includedIds) {
      const included = includedIds || agGetIncludedSubjectIds();
      let demand = 0;
      let quotaPairs = 0;
      let alreadyFilled = 0;
      let stillNeed = 0;
      (state.classes || []).forEach(c => {
        included.forEach(sid => {
          const need = (typeof getWeeklyFor === 'function') ? (getWeeklyFor(sid, c.id) || 0) : 0;
          if (need <= 0) return;
          quotaPairs++;
          demand += need;
          const placed = (typeof countSubjectForClass === 'function')
            ? countSubjectForClass(sid, c.id)
            : (state.assignments || []).filter(a => a.subjectId === sid && a.classId === c.id).length;
          const have = Math.min(placed, need);
          alreadyFilled += have;
          stillNeed += Math.max(0, need - placed);
        });
      });
      const current = (state.assignments || []).length;
      const autoCount = (state.assignments || []).filter(a => a.autoGenerated === true).length;
      const manualCount = current - autoCount;
      const rules = (typeof ensureAutoGenRules === 'function') ? ensureAutoGenRules() : {};
      const groupCount = (rules.subjectGroups || []).length;
      const syncCount = (rules.syncBlocks || []).length;
      return {
        subjects: included.length,
        quotaPairs,
        demand,
        alreadyFilled,
        stillNeed,
        current,
        autoCount,
        manualCount,
        clearExisting: !!(opts && opts.clearExisting),
        requireDouble: !!(opts && opts.requireDouble),
        scatter: !!(opts && opts.scatter),
        combinedArms: !!(opts && opts.combinedArms),
        groupCount,
        syncCount
      };
    }

    function confirmAutoGeneratePreview(opts, included) {
      const p = buildAutoGenPreview(opts, included);
      let msg = 'Autogenerate preview\n\n';
      msg += 'Subjects selected: ' + p.subjects + '\n';
      msg += 'Weekly quotas to fill: about ' + p.demand + ' period(s) across ' + p.quotaPairs + ' class×subject pair(s)\n';
      if (p.clearExisting) {
        msg += '\n⚠ Clear existing is ON — all ' + p.current + ' period(s) on the grid will be removed first.\n';
        msg += '  (' + p.manualCount + ' manual · ' + p.autoCount + ' auto)\n';
      } else {
        msg += '\nGrid now: ' + p.current + ' period(s) (' + p.manualCount + ' manual · ' + p.autoCount + ' auto)\n';
        msg += 'Already placed toward quotas: ' + p.alreadyFilled + '\n';
        msg += 'Still needed (estimate): ' + p.stillNeed + ' period(s)\n';
        msg += 'Existing periods are kept; generator fills gaps.\n';
      }
      msg += '\nOptions: double periods ' + (p.requireDouble ? 'ON' : 'OFF') +
        ' · scatter ' + (p.scatter ? 'ON' : 'OFF') +
        ' · combined arms ' + (p.combinedArms ? 'ON' : 'OFF') + '\n';
      if (p.groupCount || p.syncCount) {
        msg += 'Rules: ' + p.groupCount + ' subject group(s), ' + p.syncCount + ' same-period arm rule(s)\n';
      }
      msg += '\nOK = Generate now\nCancel = Go back (no changes)';
      return confirm(msg);
    }

    function runAutoGenerateFromModal() {
      ensureAutoGenRules();
      const included = agGetIncludedSubjectIds();
      if (!included.length) {
        showToast('Select at least one subject to generate');
        return;
      }
      const opts = {
        clearExisting: !!(document.getElementById('agClearExisting') || {}).checked,
        requireDouble: !!(document.getElementById('agRequireDouble') || {}).checked,
        scatter: !!(document.getElementById('agScatter') || {}).checked,
        combinedArms: !!(document.getElementById('agCombinedArms') || {}).checked
      };
      if (!document.getElementById('agClearExisting')) opts.clearExisting = false;
      if (!document.getElementById('agRequireDouble')) opts.requireDouble = true;
      if (!document.getElementById('agScatter')) opts.scatter = true;
      if (!document.getElementById('agCombinedArms')) opts.combinedArms = true;

      // Preview → confirm before any generate / learn / clear
      if (!confirmAutoGeneratePreview(opts, included)) {
        showToast('Autogenerate cancelled');
        return;
      }

      autoLearnBeforeGenerate();
      state._autoGenOpts = opts;
      try { localStorage.setItem('schoolMasterTimetable', JSON.stringify(state)); } catch (e) {}
      closeAutoGenModal();
      autoGenerateTimetable(opts);
    }

    /** Fisher–Yates shuffle (in place) for varied autogenerate runs */
    function shuffleArray(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = arr[i];
        arr[i] = arr[j];
        arr[j] = t;
      }
      return arr;
    }

    /** Pick among top-k best scores so each Generate run can differ (all still valid) */
    function pickVariedCandidate(sortedList, topK) {
      if (!sortedList || !sortedList.length) return null;
      const k = Math.min(topK || 8, sortedList.length);
      const best = sortedList[0].score;
      const band = sortedList.filter(c => c.score <= best + 40).slice(0, k);
      return band[Math.floor(Math.random() * band.length)] || sortedList[0];
    }


    function clearAutoGenerated(){
      const autoCount = state.assignments.filter(a=>a.autoGenerated===true && !assignmentIsLocked(a)).length;
      if (autoCount===0) { showToast('No unlocked autogenerated periods to clear'); return; }
      const kept = state.assignments.length - autoCount;
      const lockedN = state.assignments.filter(a=>assignmentIsLocked(a)).length;
      const ok = confirm('Clear autogenerated timetable?\n\nThis will remove '+autoCount+' autogenerated period(s).\nKept: '+kept+' (manual and/or locked'+(lockedN?'; '+lockedN+' locked':'')+').\n\nOK = Clear auto only\nCancel = Keep all');
      if (!ok) return;
      if (typeof pushUndo === 'function') { try{ pushUndo(); }catch(e){} }
      state.assignments = state.assignments.filter(a=>a.autoGenerated!==true || assignmentIsLocked(a));
      try { localStorage.setItem('schoolMasterTimetable', JSON.stringify(state)); if (typeof saveState==='function') saveState(); } catch(e){}
      renderTable();
      if (typeof renderCompareLeft==='function') { try{ renderCompareLeft(); renderCompareRight(); }catch(e){} }
      if (typeof updateConflicts==='function') updateConflicts();
      if (typeof updatePeriodLoadTitle==='function') updatePeriodLoadTitle();
      showToast('Cleared '+autoCount+' autogenerated periods, kept '+kept);
    }
    function clearManualOnly(){
      const manualCount = state.assignments.filter(a=>a.autoGenerated!==true && !assignmentIsLocked(a)).length;
      const autoCount = state.assignments.length - state.assignments.filter(a=>a.autoGenerated!==true && !assignmentIsLocked(a)).length;
      if (manualCount===0) { showToast('No unlocked manual periods to clear'); return; }
      const ok = confirm('Clear manually added periods?\n\nThis will remove '+manualCount+' unlocked manual period(s). Locked periods are kept.\n\nOK = Clear manual');
      if (!ok) return;
      if (typeof pushUndo==='function') { try{ pushUndo(); }catch(e){} }
      state.assignments = state.assignments.filter(a=>a.autoGenerated===true || assignmentIsLocked(a));
      try { localStorage.setItem('schoolMasterTimetable', JSON.stringify(state)); if (typeof saveState==='function') saveState(); } catch(e){}
      renderTable();
      if (typeof renderCompareLeft==='function') { try{ renderCompareLeft(); renderCompareRight(); }catch(e){} }
      if (typeof updateConflicts==='function') updateConflicts();
      showToast('Cleared '+manualCount+' manual periods');
    }



    // === LEARN FROM MANUAL GROUPINGS ===
    function learnManualGroupings(){
      ensureAutoGenRules();
      const manual = state.assignments.filter(a=>a.autoGenerated!==true);
      if (!manual.length) { showToast('No manual assignments to learn from'); return { subjectGroups:0, syncBlocks:0 }; }
      
      // 1) Learn subject groups: same class, same day+slot, multiple subjects (grouped together manually)
      const byCell = {};
      manual.forEach(a=>{
        const key = a.classId+'|'+a.day+'|'+a.slotId;
        if (!byCell[key]) byCell[key] = { classId:a.classId, day:a.day, slotId:a.slotId, subjectIds:[], groupName: a.groupName||'' };
        if (byCell[key].subjectIds.indexOf(a.subjectId)<0) byCell[key].subjectIds.push(a.subjectId);
        if (a.groupName) byCell[key].groupName = a.groupName;
      });
      
      let learnedGroups = 0;
      Object.values(byCell).forEach(cell=>{
        if (cell.subjectIds.length < 2) return;
        // Check if this exact subject set for this class already exists as a subjectGroup
        const exists = state.autoGenRules.subjectGroups.some(g=>{
          if ((g.classIds||[]).indexOf(cell.classId)<0) return false;
          const a = (g.subjectIds||[]).slice().sort().join(',');
          const b = cell.subjectIds.slice().sort().join(',');
          return a===b;
        });
        if (exists) return;
        // Create new group
        const newGroup = {
          id: 'ag' + Date.now().toString(36) + Math.random().toString(36).slice(2,5) + learnedGroups,
          name: cell.groupName || ('Learned Group ' + (state.autoGenRules.subjectGroups.length+1) + ' - ' + cell.subjectIds.map(id=> (state.subjects.find(s=>s.id===id)||{}).name||id).join(' + ')),
          subjectIds: cell.subjectIds.slice(),
          classIds: [cell.classId]
        };
        // If same subjectIds already learned for other classes, merge classIds
        const sameSubjects = state.autoGenRules.subjectGroups.find(g=>{
          const a = (g.subjectIds||[]).slice().sort().join(',');
          const b = cell.subjectIds.slice().sort().join(',');
          return a===b;
        });
        if (sameSubjects) {
          if (sameSubjects.classIds.indexOf(cell.classId)<0) sameSubjects.classIds.push(cell.classId);
        } else {
          state.autoGenRules.subjectGroups.unshift(newGroup);
          learnedGroups++;
        }
      });

      // 2) Learn sync blocks: same day+slot+subject across multiple classes (combined arms)
      const bySlotSubject = {};
      manual.forEach(a=>{
        const key = a.day+'|'+a.slotId+'|'+a.subjectId;
        if (!bySlotSubject[key]) bySlotSubject[key] = { day:a.day, slotId:a.slotId, subjectId:a.subjectId, classIds:[] };
        if (bySlotSubject[key].classIds.indexOf(a.classId)<0) bySlotSubject[key].classIds.push(a.classId);
      });
      let learnedSync = 0;
      Object.values(bySlotSubject).forEach(entry=>{
        if (entry.classIds.length < 2) return;
        // Check if sync block for this subject+classes exists
        const exists = state.autoGenRules.syncBlocks.some(b=>{
          if ((b.subjectIds||[]).indexOf(entry.subjectId)<0) return false;
          // at least 2 classes overlap
          const overlap = entry.classIds.filter(cid=> (b.classIds||[]).indexOf(cid)>=0).length;
          return overlap>=2;
        });
        if (exists) return;
        const newSync = {
          id: 'ag' + Date.now().toString(36) + Math.random().toString(36).slice(2,5) + learnedSync,
          subjectIds: [entry.subjectId],
          classIds: entry.classIds.slice(),
          useGroupId: ''
        };
        state.autoGenRules.syncBlocks.unshift(newSync);
        learnedSync++;
      });

      try{ localStorage.setItem('schoolMasterTimetable', JSON.stringify(state)); }catch(e){}
      return { subjectGroups: learnedGroups, syncBlocks: learnedSync };
    }

    function learnAndShowManualGroupings(){
      const res = learnManualGroupings();
      if (res.subjectGroups===0 && res.syncBlocks===0) {
        showToast('No new groupings learned — your manual groups already exist in Autogenerate rules');
      } else {
        showToast('🧠 Learned '+res.subjectGroups+' subject group(s) + '+res.syncBlocks+' combined arm(s) from your manual timetable');
      }
      renderAutoGenRulesUI();
    }

    function autoLearnBeforeGenerate(){
      const cb = document.getElementById('agLearnFromManual');
      if (cb && cb.checked) {
        learnManualGroupings();
      }
    }

    function autoGenerateTimetable(opts) {
      opts = opts || state._autoGenOpts || {
        clearExisting: false,
        requireDouble: true,
        scatter: true,
        combinedArms: true
      };
      if (!state.classes.length) { showToast('Add classes first'); return; }
      if (!state.subjects.length) { showToast('Add subjects first'); return; }
      const teachingSlots = state.slots.filter(s => !s.isBreak);
      if (!teachingSlots.length) { showToast('Add teaching periods first'); return; }

      window._currentAutoGenBatch = Date.now();
      if (opts.clearExisting) {
        // Clear all except locked periods
        state.assignments = (state.assignments || []).filter(a => assignmentIsLocked(a));
      }

      ensureAutoGenRules();

      // Always force configured rules first: strip conflicting cells, then rules place next
      const forcedCleared = forceAutoGenRulesCompliance();
      if (forcedCleared > 0) {
        // keep going — rules will re-place
      }

      function tryPushAssign(day, slotId, classId, subjectId) {
        // Class free? (locked periods also occupy the cell)
        if (state.assignments.some(a => a.day === day && a.slotId === slotId && a.classId === classId)) return false;
        const subj = state.subjects.find(s => s.id === subjectId);
        if (!subj) return false;
        if (isJumatCell(day, state.slots.find(s => s.id === slotId) || {})) return false;
        if (isTeacherBlockedAt(subj.teacher, day, slotId)) return false;
        if (teacherBusyInSlot(subj.teacher, day, slotId, classId, subj, null)) return false;
        if (countSubjectForClass(subjectId, classId) >= getQuotaFor(subjectId, classId)) return false;
        const rule = checkSameDaySubjectRule(subjectId, classId, day, slotId);
        if (!rule.ok) return false;
        if (wouldCreateSecondDouble(subjectId, classId, day, slotId)) return false;
        state.assignments.push({
          id: 'a' + Date.now() + Math.random().toString(36).slice(2, 7),
          day, slotId, classId, subjectId,
          autoGenerated: true,
          autoGenBatch: window._currentAutoGenBatch || Date.now()
        });
        return true;
      }

      // --- Rule 2: same-period arms — ALL listed classes get subject at same day+period ---
      let syncPlaced = 0;
      (ensureAutoGenRules().syncBlocks || []).forEach(block => {
        let classIds = (block.classIds || []).filter(Boolean);
        // If rule uses a group, also merge group's classes when arms list empty
        if (block.useGroupId) {
          const g = ensureAutoGenRules().subjectGroups.find(x => x.id === block.useGroupId);
          if (g && g.classIds && g.classIds.length && classIds.length < 2) {
            classIds = g.classIds.slice();
          }
        }
        const subjectIds = getSyncBlockSubjects(block).filter(isSubjectIncludedInAutoGen);
        if (classIds.length < 2 || !subjectIds.length) return;
        subjectIds.forEach(subjectId => {
          // Active arms = classes that still need this subject
          const active = classIds.filter(cid =>
            getWeeklyFor(subjectId, cid) > countSubjectForClass(subjectId, cid)
          );
          if (active.length < 2) return;
          const remainings = active.map(cid =>
            Math.max(0, getWeeklyFor(subjectId, cid) - countSubjectForClass(subjectId, cid))
          );
          let rounds = Math.min.apply(null, remainings);
          for (let r = 0; r < rounds; r++) {
            const stillNeed = active.filter(cid =>
              getWeeklyFor(subjectId, cid) > countSubjectForClass(subjectId, cid)
            );
            if (stillNeed.length < 2) break;
            const slot = findSyncSlotForClasses(stillNeed, subjectId, opts);
            if (!slot) break;
            stillNeed.forEach(cid => {
              if (tryPushAssign(slot.day, slot.slotId, cid, subjectId)) syncPlaced++;
            });
          }
        });
      });

      // --- Rule 1: subject groups — consecutive block on same day ---
      let groupPlaced = 0;
      (ensureAutoGenRules().subjectGroups || []).forEach(g => {
        const classIds = g.classIds || [];
        const subjectIds = (g.subjectIds || []).filter(isSubjectIncludedInAutoGen);
        if (!classIds.length || subjectIds.length < 2) return;
        classIds.forEach(classId => {
          groupPlaced += placeSubjectGroupBlock(classId, subjectIds, opts);
        });
      });

      function buildDemands() {
        const list = [];
        state.classes.forEach(c => {
          state.subjects.forEach(s => {
            if (!isSubjectIncludedInAutoGen(s.id)) return;
            const need = getWeeklyFor(s.id, c.id);
            if (need <= 0) return;
            const already = countSubjectForClass(s.id, c.id);
            list.push({
              classId: c.id,
              subjectId: s.id,
              need: need,
              placed: Math.min(already, need)
            });
          });
        });
        list.sort((a, b) => {
          const ra = a.need - a.placed;
          const rb = b.need - b.placed;
          if (rb !== ra) return rb - ra;
          return Math.random() - 0.5;
        });
        shuffleArray(list);
        return list;
      }

      function mirrorSync(classId, subjectId, day, slotId) {
        (ensureAutoGenRules().syncBlocks || []).forEach(block => {
          let classIds = (block.classIds || []).slice();
          if (block.useGroupId) {
            const g = ensureAutoGenRules().subjectGroups.find(x => x.id === block.useGroupId);
            if (g && g.classIds && g.classIds.length && classIds.length < 2) classIds = g.classIds.slice();
          }
          const subjectIds = getSyncBlockSubjects(block);
          if (classIds.indexOf(classId) < 0 || subjectIds.indexOf(subjectId) < 0) return;
          classIds.forEach(cid => {
            if (cid === classId) return;
            if (getWeeklyFor(subjectId, cid) <= countSubjectForClass(subjectId, cid)) return;
            tryPushAssign(day, slotId, cid, subjectId);
          });
        });
      }

      function fillDemandsPass(demands) {
        let placed = 0;
        let doubles = 0;
        let failed = 0;
        demands.forEach(d => {
          d.placed = countSubjectForClass(d.subjectId, d.classId);
          if (d.placed >= d.need) return;

          const skipDouble = subjectSkipsDouble(d.subjectId);
          const force2 = subjectForcesDouble(d.subjectId);
          const allowDouble = !skipDouble && (opts.requireDouble || force2);
          const remaining = d.need - d.placed;
          const wantsDouble =
            !subjectHasDoublePeriod(d.subjectId, d.classId) &&
            remaining >= 2 &&
            (
              (force2 && d.need === 2) || // 2/week ticked → must be one double
              (force2 && remaining >= 2) ||
              (opts.requireDouble && d.need > 2)
            );

          if (allowDouble && wantsDouble) {
            // For forced 2-period doubles, try several times / more variety
            const attempts = force2 && d.need === 2 ? 6 : 1;
            let gotDouble = false;
            for (let t = 0; t < attempts && !gotDouble; t++) {
              const dbl = findBestDoubleSlot(d.classId, d.subjectId, opts);
              if (!dbl) break;
              let got = 0;
              dbl.slotIds.forEach(sid => {
                if (tryPushAssign(dbl.day, sid, d.classId, d.subjectId)) {
                  d.placed++;
                  placed++;
                  got++;
                  mirrorSync(d.classId, d.subjectId, dbl.day, sid);
                }
              });
              if (got >= 2) { doubles++; gotDouble = true; }
            }
            // 2/week forced double: if still not a double, clear singles for this subject+class and retry once more
            if (force2 && d.need === 2 && !subjectHasDoublePeriod(d.subjectId, d.classId)) {
              state.assignments = state.assignments.filter(a =>
                !(a.subjectId === d.subjectId && a.classId === d.classId)
              );
              d.placed = 0;
              const dbl = findBestDoubleSlot(d.classId, d.subjectId, opts);
              if (dbl) {
                let got = 0;
                dbl.slotIds.forEach(sid => {
                  if (tryPushAssign(dbl.day, sid, d.classId, d.subjectId)) {
                    d.placed++;
                    placed++;
                    got++;
                    mirrorSync(d.classId, d.subjectId, dbl.day, sid);
                  }
                });
                if (got >= 2) doubles++;
              }
            }
          }

          // Forced 2/week double: do not place as two separate singles
          if (force2 && d.need === 2 && subjectHasDoublePeriod(d.subjectId, d.classId)) {
            return;
          }
          if (force2 && d.need === 2 && d.placed < d.need) {
            // Still incomplete — skip singles; leave for another pass / report failed
            failed++;
            return;
          }

          let stall = 0;
          while (d.placed < d.need && stall < 3) {
            const slot = findBestSlot(d.classId, d.subjectId, opts);
            if (!slot) { stall++; failed++; break; }
            if (tryPushAssign(slot.day, slot.slotId, d.classId, d.subjectId)) {
              d.placed++;
              placed++;
              stall = 0;
              mirrorSync(d.classId, d.subjectId, slot.day, slot.slotId);
            } else {
              stall++;
            }
          }
        });
        return { placed, doubles, failed };
      }

      /** Remove teacher clashes by dropping the later assignment in each clash group */
      function repairTeacherClashes() {
        let fixed = 0;
        for (let guard = 0; guard < 40; guard++) {
          const clashes = getTeacherClashes();
          const keys = Object.keys(clashes);
          if (!keys.length) break;
          keys.forEach(key => {
            const arr = clashes[key];
            if (!arr || arr.length < 2) return;
            // Prefer keeping locked; drop unlocked extras first
            const ordered = arr.slice().sort((a, b) => {
              const la = assignmentIsLocked(a) ? 0 : 1;
              const lb = assignmentIsLocked(b) ? 0 : 1;
              return la - lb;
            });
            for (let i = 1; i < ordered.length; i++) {
              if (assignmentIsLocked(ordered[i])) continue;
              const id = ordered[i].id;
              const before = state.assignments.length;
              state.assignments = state.assignments.filter(a => a.id !== id);
              if (state.assignments.length < before) fixed++;
            }
          });
        }
        return fixed;
      }

      // Multi-pass fill: different order each pass → different layouts, better coverage
      let placedTotal = syncPlaced + groupPlaced;
      let doublesPlaced = 0;
      let failed = 0;
      const startCount = state.assignments.length;

      for (let pass = 0; pass < 4; pass++) {
        // Re-assert sync & groups mid-way (gaps may have opened after repairs)
        if (pass > 0) {
          (ensureAutoGenRules().syncBlocks || []).forEach(block => {
            let classIds = (block.classIds || []).filter(Boolean);
            if (block.useGroupId) {
              const g = ensureAutoGenRules().subjectGroups.find(x => x.id === block.useGroupId);
              if (g && g.classIds && g.classIds.length && classIds.length < 2) classIds = g.classIds.slice();
            }
            const subjectIds = getSyncBlockSubjects(block);
            if (classIds.length < 2 || !subjectIds.length) return;
            subjectIds.forEach(subjectId => {
              const stillNeed = classIds.filter(cid =>
                getWeeklyFor(subjectId, cid) > countSubjectForClass(subjectId, cid)
              );
              if (stillNeed.length < 2) return;
              const rem = stillNeed.map(cid => Math.max(0, getWeeklyFor(subjectId, cid) - countSubjectForClass(subjectId, cid)));
              let rounds = Math.min.apply(null, rem);
              for (let r = 0; r < rounds; r++) {
                const needNow = stillNeed.filter(cid =>
                  getWeeklyFor(subjectId, cid) > countSubjectForClass(subjectId, cid)
                );
                if (needNow.length < 2) break;
                const slot = findSyncSlotForClasses(needNow, subjectId, opts);
                if (!slot) break;
                needNow.forEach(cid => {
                  if (tryPushAssign(slot.day, slot.slotId, cid, subjectId)) placedTotal++;
                });
              }
            });
          });
          (ensureAutoGenRules().subjectGroups || []).forEach(g => {
            if (!(g.classIds || []).length || (g.subjectIds || []).length < 2) return;
            (g.classIds || []).forEach(classId => {
              placedTotal += placeSubjectGroupBlock(classId, g.subjectIds, opts);
            });
          });
        }

        const res = fillDemandsPass(buildDemands());
        placedTotal += res.placed;
        doublesPlaced += res.doubles;
        failed = res.failed;
        const repaired = repairTeacherClashes();
        // After removing clash cells, try one more fill
        if (repaired > 0) {
          const res2 = fillDemandsPass(buildDemands());
          placedTotal += res2.placed;
          doublesPlaced += res2.doubles;
        }
      }

      // Final: force rule compliance again, re-place rules, light fill
      forceAutoGenRulesCompliance();
      (ensureAutoGenRules().syncBlocks || []).forEach(block => {
        let classIds = (block.classIds || []).filter(Boolean);
        if (block.useGroupId) {
          const g = ensureAutoGenRules().subjectGroups.find(x => x.id === block.useGroupId);
          if (g && g.classIds && g.classIds.length && classIds.length < 2) classIds = g.classIds.slice();
        }
        const subjectIds = getSyncBlockSubjects(block);
        if (classIds.length < 2 || !subjectIds.length) return;
        subjectIds.forEach(subjectId => {
          for (let r = 0; r < 12; r++) {
            const needNow = classIds.filter(cid =>
              getWeeklyFor(subjectId, cid) > countSubjectForClass(subjectId, cid)
            );
            if (needNow.length < 2) break;
            const slot = findSyncSlotForClasses(needNow, subjectId, opts);
            if (!slot) break;
            needNow.forEach(cid => { tryPushAssign(slot.day, slot.slotId, cid, subjectId); });
          }
        });
      });
      (ensureAutoGenRules().subjectGroups || []).forEach(g => {
        if (!(g.classIds || []).length || (g.subjectIds || []).length < 2) return;
        (g.classIds || []).forEach(classId => placeSubjectGroupBlock(classId, g.subjectIds, opts));
      });
      fillDemandsPass(buildDemands());
      repairTeacherClashes();
      // Last soft fill after clash repair
      fillDemandsPass(buildDemands());
      repairTeacherClashes();

      // Count remaining unfilled demands
      failed = 0;
      buildDemands().forEach(d => {
        if (countSubjectForClass(d.subjectId, d.classId) < d.need) failed++;
      });

      const clashLeft = Object.keys(getTeacherClashes()).length;
      renderTable();
      renderSubjects();
      updateConflicts();
      const added = Math.max(0, state.assignments.length - startCount);
      const msg = (opts.clearExisting
        ? 'Autogenerated: ' + state.assignments.length + ' periods on grid'
        : 'Updated: +' + added + ' period(s)') +
        (forcedCleared ? (', cleared ' + forcedCleared + ' rule conflict(s)') : '') +
        (doublesPlaced ? (', ' + doublesPlaced + ' double(s)') : '') +
        (clashLeft ? (', ' + clashLeft + ' clash group(s) left') : ', no teacher clashes') +
        (failed ? (', ' + failed + ' quota(s) incomplete') : '');
      showToast(msg);
      pushHistory();
      if (failed || clashLeft) {
        alert(msg + '\n\nRules are applied first and re-checked. Press Generate again for a different clash-free layout attempt.');
      }
    }

    /** True if this subject+class already has two consecutive teaching periods on any day */
    function subjectHasDoublePeriod(subjectId, classId) {
      const teachingIds = state.slots.filter(s => !s.isBreak).map(s => s.id);
      for (const day of state.days) {
        const onDay = state.assignments
          .filter(a => a.day === day && a.subjectId === subjectId && a.classId === classId)
          .map(a => a.slotId);
        for (let i = 0; i < teachingIds.length - 1; i++) {
          if (onDay.includes(teachingIds[i]) && onDay.includes(teachingIds[i + 1]) &&
              slotsAreConsecutive(teachingIds[i], teachingIds[i + 1])) {
            return true;
          }
        }
      }
      return false;
    }

    /**
     * True if placing subject at day/slot would create a second double period
     * (subject+class already has one consecutive pair, and this would form another).
     */
    function wouldCreateSecondDouble(subjectId, classId, day, newSlotId) {
      if (!subjectHasDoublePeriod(subjectId, classId)) return false;
      const existing = existingSubjectSlotsOnDay(subjectId, classId, day, newSlotId);
      return existing.some(sid => slotsAreConsecutive(sid, newSlotId));
    }

    /** Consecutive teaching pair free for class + teacher (for double periods). */
    function findBestDoubleSlot(classId, subjectId, opts) {
      opts = opts || {};
      const teachingSlots = state.slots.filter(s => !s.isBreak);
      const subj = state.subjects.find(s => s.id === subjectId);
      if (!subj) return null;
      // Never more than one double period per subject per class
      if (subjectHasDoublePeriod(subjectId, classId)) return null;
      if (findOtherTeacherForSubjectInClass(subj.name, subj.teacher, classId, subjectId)) return null;

      const pairs = [];
      for (let i = 0; i < teachingSlots.length - 1; i++) {
        const s1 = teachingSlots[i];
        const s2 = teachingSlots[i + 1];
        if (!slotsAreConsecutive(s1.id, s2.id)) continue;

        state.days.forEach(day => {
          if (isJumatCell(day, s1) || isJumatCell(day, s2)) return;
          if (state.assignments.some(a => a.day === day && a.classId === classId && (a.slotId === s1.id || a.slotId === s2.id))) return;
          if (isTeacherBlockedAt(subj.teacher, day, s1.id)) return;
          if (isTeacherBlockedAt(subj.teacher, day, s2.id)) return;
          if (teacherBusyInSlot(subj.teacher, day, s1.id, classId, subj, null)) return;
          if (teacherBusyInSlot(subj.teacher, day, s2.id, classId, subj, null)) return;
          const r1 = checkSameDaySubjectRule(subjectId, classId, day, s1.id);
          if (!r1.ok) return;
          const existingOnDay = existingSubjectSlotsOnDay(subjectId, classId, day, null);
          if (existingOnDay.length) return;

          const dayLoad = state.assignments.filter(a => a.day === day && a.classId === classId).length;
          // Random jitter so each Generate can choose different double slots
          const score = dayLoad * 10 + i + Math.random() * 6;
          pairs.push({ day, slotIds: [s1.id, s2.id], score });
        });
      }
      if (!pairs.length) return null;
      pairs.sort((a, b) => a.score - b.score);
      return pickVariedCandidate(pairs, 4);
    }

    function findBestSlot(classId, subjectId, opts) {
      opts = opts || state._autoGenOpts || {};
      const teachingSlots = state.slots.filter(s => !s.isBreak);
      const subj = state.subjects.find(s => s.id === subjectId);
      if (!subj) return null;

      const candidates = [];

      if (findOtherTeacherForSubjectInClass(subj.name, subj.teacher, classId, subjectId)) {
        return null;
      }

      const placedIdx = [];
      state.assignments.forEach(a => {
        if (a.subjectId !== subjectId || a.classId !== classId) return;
        const idx = teachingSlots.findIndex(s => s.id === a.slotId);
        if (idx >= 0) placedIdx.push(idx);
      });

      // Randomize scan order of days/slots slightly so different runs explore differently
      const daysOrder = state.days.slice();
      if (Math.random() < 0.5) shuffleArray(daysOrder);
      const slotsOrder = teachingSlots.slice();
      if (Math.random() < 0.35) shuffleArray(slotsOrder);

      daysOrder.forEach(day => {
        slotsOrder.forEach(slot => {
          if (isJumatCell(day, slot)) return;

          const classBusy = state.assignments.some(a =>
            a.day === day && a.slotId === slot.id && a.classId === classId
          );
          if (classBusy) return;

          if (isTeacherBlockedAt(subj.teacher, day, slot.id)) return;
          if (teacherBusyInSlot(subj.teacher, day, slot.id, classId, subj, null)) return;

          if (countSubjectForClass(subjectId, classId) >= getQuotaFor(subjectId, classId)) return;

          const rule = checkSameDaySubjectRule(subjectId, classId, day, slot.id);
          if (!rule.ok) return;

          const onDay = existingSubjectSlotsOnDay(subjectId, classId, day, null).length;
          const dayLoad = state.assignments.filter(a => a.day === day && a.classId === classId).length;
          const slotIdx = teachingSlots.findIndex(s => s.id === slot.id);

          let scatterPenalty = 0;
          if (opts.scatter && placedIdx.length) {
            const minDist = Math.min(...placedIdx.map(i => Math.abs(i - slotIdx)));
            scatterPenalty = Math.max(0, 8 - minDist) * 40;
          }

          // Rule 1: prefer days that already have other subjects from the same group
          let groupBonus = 0;
          if (opts.preferGroupSubjects && opts.preferGroupSubjects.length) {
            const groupOnDay = state.assignments.filter(a =>
              a.day === day && a.classId === classId &&
              opts.preferGroupSubjects.indexOf(a.subjectId) >= 0
            ).length;
            groupBonus = groupOnDay ? -35 * groupOnDay : 15; // negative = better score
          }

          // Base heuristics + noise → different valid layouts each Generate
          const score = onDay * 100 + dayLoad * 10 + scatterPenalty + slotIdx * 0.5 + groupBonus + Math.random() * 28;

          candidates.push({ day, slotId: slot.id, score });
        });
      });

      if (!candidates.length) return null;
      candidates.sort((a, b) => a.score - b.score);
      return pickVariedCandidate(candidates, 10);
    }

    // ========== PERSONAL READING / STUDY TIMETABLE ==========
    function getStudyColors() {
      return (typeof COLORS !== 'undefined' && COLORS.length) ? COLORS : [
        '#4f46e5', '#0284c7', '#0d9488', '#ca8a04', '#e11d48', '#7c3aed', '#ea580c', '#16a34a'
      ];
    }

    /** Periods used by the personal reading grid (custom or school teaching periods). */
    function getStudySlots() {
      if (state.studyUseSchoolSlots === false) {
        return (state.studySlots || []).filter(function (s) { return !s.isBreak; });
      }
      return (state.slots || []).filter(function (s) { return !s.isBreak; });
    }

    function setStudySlotMode(useSchool) {
      state.studyUseSchoolSlots = !!useSchool;
      const panel = document.getElementById('studySlotsPanel');
      const school = document.getElementById('studySlotModeSchool');
      const custom = document.getElementById('studySlotModeCustom');
      if (school) school.checked = !!useSchool;
      if (custom) custom.checked = !useSchool;
      if (panel) panel.style.display = useSchool ? 'none' : 'block';
      if (!useSchool && typeof renderStudySlots === 'function') renderStudySlots();
      if (state.currentView === 'study') {
        if (typeof switchView === 'function') switchView('study');
        else if (typeof renderTable === 'function') renderTable();
      }
      if (typeof pushHistory === 'function') pushHistory();
      else if (typeof autosaveNow === 'function') autosaveNow();
    }

    function syncStudySlotModeUi() {
      const useSchool = state.studyUseSchoolSlots !== false;
      const school = document.getElementById('studySlotModeSchool');
      const custom = document.getElementById('studySlotModeCustom');
      const panel = document.getElementById('studySlotsPanel');
      if (school) school.checked = useSchool;
      if (custom) custom.checked = !useSchool;
      if (panel) panel.style.display = useSchool ? 'none' : 'block';
      if (!useSchool && typeof renderStudySlots === 'function') renderStudySlots();
    }

    function renderStudySlots() {
      const list = document.getElementById('studySlotList');
      if (!list) return;
      const items = state.studySlots || [];
      if (!items.length) {
        list.innerHTML = '<p style="color:var(--muted);font-size:0.78rem;text-align:center;padding:6px;">No custom study periods yet</p>';
        return;
      }
      list.innerHTML = items.map(function (s, idx) {
        const time = (s.start && s.end) ? (s.start + '–' + s.end) : '';
        return '<div class="list-item">' +
          '<div class="subj-main" style="flex:1;min-width:0;">' +
            '<div class="name">' + escapeHtml(s.label || ('Study ' + (idx + 1))) + '</div>' +
            '<div class="meta">' + escapeHtml(time) + '</div>' +
          '</div>' +
          '<button class="icon-btn" onclick="deleteStudySlot(\'' + s.id + '\')" title="Delete">🗑️</button></div>';
      }).join('');
    }

    function addStudySlot() {
      const label = (document.getElementById('studySlotLabel').value || '').trim() ||
        ('Study ' + ((state.studySlots || []).length + 1));
      const start = (document.getElementById('studySlotStart').value || '').trim();
      const end = (document.getElementById('studySlotEnd').value || '').trim();
      if (!state.studySlots) state.studySlots = [];
      state.studySlots.push({
        id: 'ssp' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
        label: label,
        start: start,
        end: end,
        isBreak: false
      });
      document.getElementById('studySlotLabel').value = '';
      // nudge times for next add
      if (end) {
        document.getElementById('studySlotStart').value = end;
        // +1 hour rough default left to user
      }
      renderStudySlots();
      state.studyUseSchoolSlots = false;
      syncStudySlotModeUi();
      if (state.currentView === 'study') switchView('study');
      showToast('Study period added');
      pushHistory();
    }

    function deleteStudySlot(id) {
      state.studySlots = (state.studySlots || []).filter(function (s) { return s.id !== id; });
      state.studyAssignments = (state.studyAssignments || []).filter(function (a) { return a.slotId !== id; });
      renderStudySlots();
      if (state.currentView === 'study') switchView('study');
      showToast('Study period removed');
      pushHistory();
    }

    function copySchoolSlotsToStudy() {
      const school = (state.slots || []).filter(function (s) { return !s.isBreak; });
      if (!school.length) { showToast('No school teaching periods to copy'); return; }
      if ((state.studySlots || []).length &&
          !confirm('Replace your custom study periods with a copy of school periods?')) return;
      state.studySlots = school.map(function (s, i) {
        return {
          id: 'ssp' + Date.now() + '_' + i,
          label: s.label || ('Period ' + (i + 1)),
          start: s.start || '',
          end: s.end || '',
          isBreak: false
        };
      });
      state.studyUseSchoolSlots = false;
      syncStudySlotModeUi();
      renderStudySlots();
      if (state.currentView === 'study') switchView('study');
      showToast('Copied ' + state.studySlots.length + ' school periods — edit times as you like');
      pushHistory();
    }

    function renderStudySubjects() {
      const list = document.getElementById('studySubjectList');
      if (!list) return;
      const items = state.studySubjects || [];
      if (!items.length) {
        list.innerHTML = '<p style="color:var(--muted);font-size:0.82rem;text-align:center;padding:8px;">No study subjects yet</p>';
        return;
      }
      list.innerHTML = items.map(function (s) {
        const placed = (state.studyAssignments || []).filter(function (a) { return a.subjectId === s.id; }).length;
        const need = s.periods || 0;
        const ok = placed >= need && need > 0;
        const col = ok ? '#16a34a' : (placed > 0 ? '#ca8a04' : '#64748b');
        return '<div class="list-item">' +
          '<div class="color-dot" style="background:' + (s.color || '#0284c7') + '"></div>' +
          '<div class="subj-main" style="flex:1;min-width:0;">' +
            '<div class="name">' + escapeHtml(s.name) + '</div>' +
            '<div class="meta" style="color:' + col + ';">' + placed + '/' + need + ' periods</div>' +
          '</div>' +
          '<button class="icon-btn" onclick="openStudySubjectModal(\'' + s.id + '\')" title="Edit">✏️</button>' +
          '<button class="icon-btn" onclick="deleteStudySubject(\'' + s.id + '\')" title="Delete">🗑️</button></div>';
      }).join('');
    }

    function openStudySubjectModal(id) {
      state.editingStudySubjectId = id || null;
      const title = document.getElementById('studySubjectModalTitle');
      if (title) title.textContent = id ? 'Edit study subject' : 'Add study subject';
      const colors = getStudyColors();
      let color = colors[0];
      if (id) {
        const s = (state.studySubjects || []).find(function (x) { return x.id === id; });
        if (s) {
          document.getElementById('studySubjName').value = s.name || '';
          document.getElementById('studySubjPeriods').value = s.periods || 1;
          color = s.color || color;
        }
      } else {
        document.getElementById('studySubjName').value = '';
        document.getElementById('studySubjPeriods').value = 3;
        color = colors[(state.studySubjects || []).length % colors.length];
      }
      const picker = document.getElementById('studyColorPicker');
      if (picker) {
        picker.innerHTML = colors.map(function (c) {
          return '<div class="color-swatch' + (c === color ? ' selected' : '') + '" style="background:' + c + '" data-color="' + c + '" onclick=\"selectStudyColor(\'' + c + '\')\"></div>';
        }).join('');
      }
      document.getElementById('studySubjectModal').classList.add('open');
      try { document.getElementById('studySubjName').focus(); } catch (e) {}
    }

    function selectStudyColor(c) {
      document.querySelectorAll('#studyColorPicker .color-swatch').forEach(function (el) {
        el.classList.toggle('selected', el.dataset.color === c);
      });
    }

    function closeStudySubjectModal() {
      const m = document.getElementById('studySubjectModal');
      if (m) m.classList.remove('open');
      state.editingStudySubjectId = null;
    }

    function saveStudySubject() {
      const name = (document.getElementById('studySubjName').value || '').trim();
      const periods = Math.max(1, parseInt(document.getElementById('studySubjPeriods').value, 10) || 1);
      const sw = document.querySelector('#studyColorPicker .color-swatch.selected');
      const color = (sw && sw.dataset.color) || getStudyColors()[0];
      if (!name) { showToast('Subject name required'); return; }
      if (!state.studySubjects) state.studySubjects = [];
      if (state.editingStudySubjectId) {
        const s = state.studySubjects.find(function (x) { return x.id === state.editingStudySubjectId; });
        if (s) { s.name = name; s.periods = periods; s.color = color; }
        showToast('Study subject updated');
      } else {
        state.studySubjects.push({
          id: 'st' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          name: name,
          periods: periods,
          color: color
        });
        showToast('Study subject added');
      }
      closeStudySubjectModal();
      renderStudySubjects();
      if (state.currentView === 'study') switchView('study');
      pushHistory();
    }

    function deleteStudySubject(id) {
      if (!confirm('Delete this study subject and remove it from the reading timetable?')) return;
      state.studySubjects = (state.studySubjects || []).filter(function (s) { return s.id !== id; });
      state.studyAssignments = (state.studyAssignments || []).filter(function (a) { return a.subjectId !== id; });
      renderStudySubjects();
      if (state.currentView === 'study') renderTable();
      showToast('Study subject deleted');
      pushHistory();
    }

    function openStudyAssignModal(day, slotId) {
      state.currentStudySlot = { day: day, slotId: slotId };
      const slotPool = (typeof getStudySlots === 'function') ? getStudySlots() : (state.slots || []);
      const slot = slotPool.find(function (s) { return s.id === slotId; }) ||
        (state.slots || []).find(function (s) { return s.id === slotId; }) ||
        (state.studySlots || []).find(function (s) { return s.id === slotId; });
      const title = document.getElementById('studyAssignTitle');
      if (title) title.textContent = 'Study · ' + day + (slot ? (' · ' + slot.label) : '');
      const lab = document.getElementById('studyAssignSlotLabel');
      if (lab) lab.textContent = (slot && slot.start && slot.end) ? (slot.start + ' – ' + slot.end) : '';
      const sel = document.getElementById('studyAssignSubject');
      const items = state.studySubjects || [];
      if (!items.length) {
        sel.innerHTML = '<option value="">Add study subjects first</option>';
      } else {
        sel.innerHTML = items.map(function (s) {
          return '<option value="' + s.id + '">' + escapeHtml(s.name) + ' (' + (s.periods || 0) + '/wk)</option>';
        }).join('');
      }
      const existing = (state.studyAssignments || []).find(function (a) {
        return a.day === day && a.slotId === slotId;
      });
      const host = document.getElementById('studyAssignExisting');
      if (existing) {
        const subj = items.find(function (s) { return s.id === existing.subjectId; });
        host.innerHTML = '<div style="padding:8px 10px;background:#f0f9ff;border-radius:8px;font-size:0.85rem;">Currently: <strong>' +
          escapeHtml(subj ? subj.name : 'Subject') + '</strong></div>';
        if (subj) sel.value = existing.subjectId;
      } else {
        host.innerHTML = '';
      }
      document.getElementById('studyAssignModal').classList.add('open');
    }

    function closeStudyAssignModal() {
      const m = document.getElementById('studyAssignModal');
      if (m) m.classList.remove('open');
      state.currentStudySlot = null;
    }

    function saveStudyAssignment() {
      if (!state.currentStudySlot) return;
      const subjectId = document.getElementById('studyAssignSubject').value;
      if (!subjectId) { showToast('Select a study subject'); return; }
      const day = state.currentStudySlot.day;
      const slotId = state.currentStudySlot.slotId;
      if (!state.studyAssignments) state.studyAssignments = [];
      const existing = state.studyAssignments.find(function (a) {
        return a.day === day && a.slotId === slotId;
      });
      if (existing) {
        existing.subjectId = subjectId;
        showToast('Study period updated');
      } else {
        state.studyAssignments.push({
          id: 'sa' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          day: day,
          slotId: slotId,
          subjectId: subjectId
        });
        showToast('Study period placed');
      }
      closeStudyAssignModal();
      renderStudySubjects();
      renderTable();
      if (state.currentView === 'study') switchView('study');
      pushHistory();
    }

    function clearStudyCell() {
      if (!state.currentStudySlot) return;
      const day = state.currentStudySlot.day;
      const slotId = state.currentStudySlot.slotId;
      state.studyAssignments = (state.studyAssignments || []).filter(function (a) {
        return !(a.day === day && a.slotId === slotId);
      });
      closeStudyAssignModal();
      renderStudySubjects();
      renderTable();
      showToast('Study cell cleared');
      pushHistory();
    }

    function clearStudyAssignments() {
      if (!(state.studyAssignments || []).length) { showToast('Study grid already empty'); return; }
      if (!confirm('Clear all periods from the personal reading timetable?\\n\\nStudy subjects list will be kept.')) return;
      state.studyAssignments = [];
      renderStudySubjects();
      renderTable();
      if (state.currentView === 'study') switchView('study');
      showToast('Study timetable cleared');
      pushHistory();
    }

    function autoGenerateStudyTimetable() {
      const subjects = state.studySubjects || [];
      if (!subjects.length) {
        showToast('Add study subjects first (Setup → Study subjects)');
        return;
      }
      const days = state.days || [];
      const slots = (typeof getStudySlots === 'function') ? getStudySlots() : (state.slots || []).filter(function (s) { return !s.isBreak; });
      if (!days.length) {
        showToast('Set weekdays in Settings first');
        return;
      }
      if (!slots.length) {
        showToast('Add study periods (custom) or choose “Same as school periods”');
        return;
      }
      const totalNeed = subjects.reduce(function (n, s) { return n + (s.periods || 0); }, 0);
      const capacity = days.length * slots.length;
      if (totalNeed > capacity) {
        alert('You need ' + totalNeed + ' periods but the week only has ' + capacity +
          ' free slots (days × periods).\\n\\nReduce periods per subject or add more periods/days.');
        return;
      }
      if (!confirm('Auto-generate personal reading timetable?\\n\\n' +
          '• Places each study subject across the week\\n' +
          '• Uses your period times from Settings\\n' +
          '• Clears the current study grid first\\n\\nContinue?')) return;

      state.studyAssignments = [];
      // Build free cells in day-major order, spread subjects
      const free = [];
      days.forEach(function (day) {
        slots.forEach(function (slot) {
          free.push({ day: day, slotId: slot.id });
        });
      });
      // Shuffle lightly by interleaving: take slots round-robin by day index
      // Demand queue
      const queue = [];
      subjects.forEach(function (s) {
        const n = Math.max(0, s.periods || 0);
        for (let i = 0; i < n; i++) queue.push(s.id);
      });
      // Spread: assign with max gap — fill using step through free list
      let placed = 0;
      const used = {};
      queue.forEach(function (subjectId, qi) {
        // Prefer slot that keeps same subject from clustering too much: pick free[i] cycling
        let best = -1;
        const start = Math.floor((qi * free.length) / Math.max(1, queue.length)) % free.length;
        for (let k = 0; k < free.length; k++) {
          const idx = (start + k) % free.length;
          const cell = free[idx];
          const key = cell.day + '|' + cell.slotId;
          if (used[key]) continue;
          best = idx;
          break;
        }
        if (best < 0) return;
        const cell = free[best];
        const key = cell.day + '|' + cell.slotId;
        used[key] = true;
        state.studyAssignments.push({
          id: 'sa' + Date.now() + '_' + qi + '_' + Math.random().toString(36).slice(2, 5),
          day: cell.day,
          slotId: cell.slotId,
          subjectId: subjectId
        });
        placed++;
      });

      switchView('study');
      renderStudySubjects();
      showToast('Study plan generated: ' + placed + ' periods placed');
      pushHistory();
    }

    // ========== EXAM / CA TIMETABLE ==========
    function getExamsForSlot(day, slotId) {
      return (state.exams || []).filter(e => e.day === day && e.slotId === slotId);
    }

    function getExamDutyClashes() {
      // Whole-day duties: same invigilator may appear on every paper for one arm;
      // same supervisor may appear on every paper for all arms of one class.
      // Clash only if a person covers different arms/classes (or mixes inv+sup on different groups) the same day.
      const clashes = {};

      function classBase(classId) {
        const c = state.classes.find(function (x) { return x.id === classId; });
        if (!c) return classId || '';
        return (typeof getClassArmBase === 'function' && getClassArmBase(c.name)) || c.name || classId;
      }

      // day|person -> { invClassIds: Set, supBases: Set, exams: [] }
      const byDayPerson = {};
      (state.exams || []).forEach(function (e) {
        [['invigilator', 'inv'], ['supervisor', 'sup']].forEach(function (pair) {
          const role = pair[0];
          const name = (e[role] || '').toLowerCase().trim();
          if (!name) return;
          const key = e.day + '|' + name;
          if (!byDayPerson[key]) {
            byDayPerson[key] = { invClassIds: {}, supBases: {}, exams: [] };
          }
          const rec = byDayPerson[key];
          rec.exams.push(e);
          if (role === 'invigilator') rec.invClassIds[e.classId] = true;
          else rec.supBases[String(classBase(e.classId)).toLowerCase()] = true;
        });
      });

      Object.keys(byDayPerson).forEach(function (key) {
        const rec = byDayPerson[key];
        const invClasses = Object.keys(rec.invClassIds);
        const supBases = Object.keys(rec.supBases);
        let bad = false;
        // Invigilator for more than one arm the same day
        if (invClasses.length > 1) bad = true;
        // Supervisor for more than one class group the same day
        if (supBases.length > 1) bad = true;
        // Same person invigilates one arm and supervises a different class group
        if (invClasses.length && supBases.length) {
          invClasses.forEach(function (cid) {
            const b = String(classBase(cid)).toLowerCase();
            if (supBases.some(function (sb) { return sb !== b; })) bad = true;
          });
        }
        if (!bad) return;
        const parts = key.split('|');
        const day = parts[0];
        const person = parts.slice(1).join('|');
        const clashKey = day + '|*|' + person;
        clashes[clashKey] = rec.exams;
      });

      // Same-slot double-booking across unrelated duties still flagged via day-level rule above.
      return clashes;
    }

    function isExamInClash(examId, clashes) {
      return Object.values(clashes).some(arr => arr.some(e => e.id === examId));
    }

    function updateExamConflicts() {
      const panel = document.getElementById('conflictsPanel');
      const headLabel = document.getElementById('conflictsHeadLabel');
      const card = document.getElementById('conflictsCard');
      if (!panel) return;
      const clashes = getExamDutyClashes();
      const keys = Object.keys(clashes);
      if (keys.length === 0) {
        panel.className = 'conflicts-box ok';
        panel.innerHTML = '<p style="color:var(--muted);font-size:0.8rem;">Invigilators and supervisors are free in their assigned slots.</p>';
        if (headLabel) headLabel.textContent = '✅ No duty clashes';
        if (card) {
          card.classList.add('no-clashes');
          card.classList.remove('has-clashes');
        }
        return;
      }
      panel.className = 'conflicts-box';
      if (headLabel) {
        headLabel.textContent = '⚠️ ' + keys.length + ' duty clash' + (keys.length > 1 ? 'es' : '');
      }
      if (card) {
        card.classList.add('has-clashes');
        card.classList.remove('no-clashes');
      }
      let html = '<p style="font-size:0.75rem;color:#7f1d1d;margin-bottom:8px;">Tap a clash to jump to that exam cell.</p>';
      keys.forEach(key => {
        const parts = key.split('|');
        const day = parts[0], slotId = parts[1], person = parts[2];
        const slot = (state.examSlots || []).find(s => s.id === slotId) || state.slots.find(s => s.id === slotId);
        const arr = clashes[key];
        const firstClassId = (arr[0] && arr[0].classId) ? arr[0].classId : '';
        const details = arr.map(e => {
          const c = state.classes.find(x => x.id === e.classId);
          return (c ? c.name : '?');
        }).join(' + ');
        const jumpArgs = '\'' + escapeHtml(day) + '\',\'' + escapeHtml(slotId) + '\',\'' + escapeHtml(firstClassId) + '\'';
        html += '<div class="conflict-item" onclick="jumpToClash(' + jumpArgs + ')" title="Jump to this exam cell">' +
          '<strong>' + escapeHtml(person) + '</strong> · ' + escapeHtml(day) + ' · ' + (slot ? escapeHtml(slot.label) : '?') +
          '<br><span style="font-size:0.78rem;">' + escapeHtml(details) + '</span>' +
          '<div><button type="button" class="btn btn-secondary btn-xs conflict-jump-btn" onclick="event.stopPropagation(); jumpToClash(' + jumpArgs + ')">📍 Go to cell</button></div>' +
          '</div>';
      });
      panel.innerHTML = html;
    }

    function openExamModal(day, slotId, preselectClassId) {
      if (state.currentView !== 'exam') return;
      const slot = (state.examSlots || []).find(s => s.id === slotId);
      if (!slot || slot.isBreak) return;
      state.currentExamSlot = { day, slotId };
      const sched = getExamSchedule().find(r => examDayKey(r) === day);
      const dayTitle = sched
        ? (sched.day + (sched.date ? ' · ' + formatExamDate(sched.date) : ''))
        : day;
      document.getElementById('examModalTitle').textContent = 'Exam / CA · ' + slot.label + ' · ' + dayTitle;
      document.getElementById('examSlotLabel').textContent = (slot.start && slot.end) ? (slot.start + ' – ' + slot.end) : '';

      const teachers = getUniqueTeachers();
      const classOpts = (state.classes || []).map(function (c) {
        return { value: c.id, label: c.name };
      });
      const subjOpts = (state.subjects || []).map(function (s) {
        return { value: s.id, label: s.name + (s.teacher ? ' (' + s.teacher + ')' : '') };
      });
      const teacherOpts = teachers.map(function (t) {
        return { value: t, label: t };
      });

      function applyWholeDayDutiesFromClass() {
        const cid = (document.getElementById('examClass') || {}).value;
        if (!cid || !state.currentExamSlot) return;
        const day = state.currentExamSlot.day;
        const invHit = (state.exams || []).find(function (e) {
          return e.day === day && e.classId === cid && (e.invigilator || '').trim();
        });
        if (invHit && invHit.invigilator) {
          bindExamCombo('examInvigilator', teacherOpts, invHit.invigilator, checkExamClashPreview);
        }
        const supHit = (state.exams || []).find(function (e) {
          return e.day === day && (e.supervisor || '').trim() &&
            (typeof classesAreSameArmGroup === 'function'
              ? classesAreSameArmGroup(e.classId, cid)
              : e.classId === cid);
        });
        if (supHit && supHit.supervisor) {
          bindExamCombo('examSupervisor', teacherOpts, supHit.supervisor, checkExamClashPreview);
        }
      }

      bindExamCombo('examClass', classOpts, preselectClassId || '', function () {
        applyWholeDayDutiesFromClass();
        checkExamClashPreview();
      });
      bindExamCombo('examSubject', subjOpts, subjOpts[0] ? subjOpts[0].value : '', checkExamClashPreview);
      const invPref = teacherOpts[0] ? teacherOpts[0].value : '';
      const supPref = teacherOpts[1] ? teacherOpts[1].value : (teacherOpts[0] ? teacherOpts[0].value : '');
      bindExamCombo('examInvigilator', teacherOpts, invPref, checkExamClashPreview);
      bindExamCombo('examSupervisor', teacherOpts, supPref, checkExamClashPreview);
      applyWholeDayDutiesFromClass();

      renderExamExisting();
      checkExamClashPreview();
      document.getElementById('examModal').classList.add('open');
    }

    /**
     * Searchable combobox for Exam/CA modal fields.
     * prefix: 'examClass' | 'examSubject' | 'examInvigilator' | 'examSupervisor'
     * options: [{ value, label }]
     */
    function bindExamCombo(prefix, options, preselectValue, onChange) {
      const hidden = document.getElementById(prefix);
      const input = document.getElementById(prefix + 'Input');
      const toggle = document.getElementById(prefix + 'Toggle');
      const box = document.getElementById(prefix + 'Combo');
      if (!hidden || !input || !toggle || !box) return;

      const portalKey = '_examPortal_' + prefix;
      if (window[portalKey]) {
        try { window[portalKey].remove(); } catch (e) {}
        window[portalKey] = null;
      }

      options = options || [];
      let open = false;
      let highlight = -1;

      const pre = options.find(function (o) { return o.value === preselectValue; })
        || options.find(function (o) { return o.label === preselectValue; });
      hidden.value = pre ? pre.value : '';
      input.value = pre ? pre.label : '';

      const portal = document.createElement('ul');
      portal.className = 'combo-portal-list';
      portal.style.display = 'none';
      document.body.appendChild(portal);
      window[portalKey] = portal;

      function filtered() {
        const q = (input.value || '').toLowerCase().trim();
        if (hidden.value) {
          const sel = options.find(function (o) { return o.value === hidden.value; });
          if (sel && input.value === sel.label) return options.slice();
        }
        if (!q) return options.slice();
        return options.filter(function (o) {
          return o.label.toLowerCase().indexOf(q) !== -1;
        });
      }

      function placePortal() {
        const rect = input.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const width = Math.min(rect.width, vw - 16);
        let left = rect.left;
        if (left + width > vw - 8) left = Math.max(8, vw - 8 - width);
        if (left < 8) left = 8;
        const spaceBelow = vh - rect.bottom - 8;
        const maxH = Math.min(240, Math.max(100, spaceBelow));
        portal.style.left = left + 'px';
        portal.style.top = (rect.bottom + 2) + 'px';
        portal.style.width = width + 'px';
        portal.style.maxHeight = maxH + 'px';
      }

      function renderPortal() {
        const items = filtered();
        if (!items.length) {
          portal.innerHTML = '<li class="combo-empty">No matches</li>';
        } else {
          portal.innerHTML = items.map(function (o, i) {
            return '<li data-value="' + escapeHtml(o.value) + '" data-label="' + escapeHtml(o.label) + '"' +
              (i === highlight ? ' class="highlight"' : '') + '>' + escapeHtml(o.label) + '</li>';
          }).join('');
        }
      }

      function openList() {
        open = true;
        highlight = 0;
        renderPortal();
        placePortal();
        portal.style.display = 'block';
        toggle.textContent = '▲';
      }

      function closeList(restoreLabel) {
        open = false;
        portal.style.display = 'none';
        toggle.textContent = '▼';
        if (restoreLabel !== false) {
          const sel = options.find(function (o) { return o.value === hidden.value; });
          input.value = sel ? sel.label : '';
        }
      }

      function selectOpt(value, label) {
        hidden.value = value || '';
        input.value = label || '';
        closeList(false);
        if (typeof onChange === 'function') onChange();
      }

      input.onfocus = function () {
        openList();
        setTimeout(function () { try { input.select(); } catch (e) {} }, 15);
      };
      input.onclick = function () {
        openList();
        setTimeout(function () { try { input.select(); } catch (e) {} }, 15);
      };
      input.oninput = function () {
        hidden.value = '';
        highlight = 0;
        if (!open) openList();
        else renderPortal();
      };
      input.onkeydown = function (e) {
        const items = filtered();
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (!open) openList();
          else { highlight = Math.min(items.length - 1, highlight + 1); renderPortal(); }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          highlight = Math.max(0, highlight - 1);
          renderPortal();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (open && items[highlight]) selectOpt(items[highlight].value, items[highlight].label);
          else closeList(true);
        } else if (e.key === 'Escape') {
          closeList(true);
        }
      };
      toggle.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (open) closeList(true);
        else { openList(); input.focus(); }
      };
      portal.onmousedown = function (e) {
        const li = e.target.closest('li');
        if (!li || !li.getAttribute('data-value')) return;
        e.preventDefault();
        selectOpt(li.getAttribute('data-value'), li.getAttribute('data-label'));
      };
      if (!window._examComboDocClose) {
        window._examComboDocClose = true;
        document.addEventListener('mousedown', function (e) {
          ['examClass', 'examSubject', 'examInvigilator', 'examSupervisor'].forEach(function (p) {
            const portalEl = window['_examPortal_' + p];
            const boxEl = document.getElementById(p + 'Combo');
            if (!portalEl || portalEl.style.display === 'none') return;
            if (boxEl && (boxEl.contains(e.target) || portalEl.contains(e.target))) return;
            portalEl.style.display = 'none';
            const tog = document.getElementById(p + 'Toggle');
            if (tog) tog.textContent = '▼';
            const hid = document.getElementById(p);
            const inp = document.getElementById(p + 'Input');
            if (hid && inp) {
              // restore label if value set — options not in scope; leave typed text
            }
          });
        });
      }
    }

    function closeExamModal() {
      document.getElementById('examModal').classList.remove('open');
      state.currentExamSlot = null;
    }

    function renderExamExisting() {
      const box = document.getElementById('examExisting');
      if (!state.currentExamSlot || !box) return;
      const { day, slotId } = state.currentExamSlot;
      const sessions = getExamsForSlot(day, slotId);
      if (!sessions.length) {
        box.innerHTML = '<p style="color:var(--muted);font-size:0.85rem;">No exam/CA sessions in this period yet.</p>';
        return;
      }
      const clashes = getExamDutyClashes();
      box.innerHTML = sessions.map(e => {
        const cls = state.classes.find(c => c.id === e.classId);
        const subj = state.subjects.find(s => s.id === e.subjectId);
        const inClash = isExamInClash(e.id, clashes);
        return '<div class="modal-entry" style="' + (inClash ? 'border-color:#f87171;background:#fef2f2;' : '') + '">' +
          '<div class="color-dot" style="background:' + (subj?.color || '#999') + '"></div>' +
          '<div class="info"><strong>' + escapeHtml(cls?.name || '?') + '</strong> · ' + escapeHtml(subj?.name || 'Exam') +
          '<div style="font-size:0.75rem;color:var(--muted);">Invigilator: ' + escapeHtml(e.invigilator || '—') +
          ' · Supervisor: ' + escapeHtml(e.supervisor || '—') + '</div>' +
          (inClash ? '<div style="color:#dc2626;font-size:0.75rem;font-weight:600;">⚠️ Duty clash</div>' : '') +
          '</div><button class="btn btn-danger btn-xs" onclick="removeExamSession(\'' + e.id + '\')">Remove</button></div>';
      }).join('');
    }

    function checkExamClashPreview() {
      const el = document.getElementById('examClashWarning');
      if (!el || !state.currentExamSlot) return;
      const inv = (document.getElementById('examInvigilator').value || '').trim();
      const sup = (document.getElementById('examSupervisor').value || '').trim();
      const classId = document.getElementById('examClass').value;
      const { day, slotId } = state.currentExamSlot;
      const msgs = [];
      if (inv && sup && inv.toLowerCase() === sup.toLowerCase()) {
        msgs.push('⚠️ Same person as invigilator and supervisor — consider different staff for the arm.');
      }
      ['invigilator', 'supervisor'].forEach((role, idx) => {
        const name = idx === 0 ? inv : sup;
        if (!name) return;
        const n = name.toLowerCase().trim();
        const busy = (state.exams || []).some(function (e) {
          if (e.day !== day || e.classId === classId) return false;
          const isInv = (e.invigilator || '').toLowerCase().trim() === n;
          const isSup = (e.supervisor || '').toLowerCase().trim() === n;
          if (!isInv && !isSup) return false;
          // Same arm: same invigilator all day is fine
          if (role === 'invigilator' && isInv && e.classId === classId) return false;
          // Same class group: shared supervisor all day is fine
          if (role === 'supervisor' && isSup &&
              typeof classesAreSameArmGroup === 'function' &&
              classesAreSameArmGroup(e.classId, classId)) {
            return false;
          }
          if (role === 'invigilator' && isInv && e.classId !== classId) return true;
          if (role === 'supervisor' && isSup &&
              !(typeof classesAreSameArmGroup === 'function' && classesAreSameArmGroup(e.classId, classId))) {
            return true;
          }
          // Invigilating elsewhere while selected as supervisor (or vice versa) on another group
          if (role === 'supervisor' && isInv &&
              !(typeof classesAreSameArmGroup === 'function' && classesAreSameArmGroup(e.classId, classId))) {
            return true;
          }
          if (role === 'invigilator' && isSup &&
              !(typeof classesAreSameArmGroup === 'function' && classesAreSameArmGroup(e.classId, classId))) {
            return true;
          }
          return false;
        });
        if (busy) msgs.push('⚠️ <strong>' + escapeHtml(name) + '</strong> already on duty for another class this exam day.');
      });
      if (msgs.length) {
        el.style.display = 'block';
        el.innerHTML = msgs.join('<br>');
      } else {
        el.style.display = 'none';
      }
    }

    function saveExamSession() {
      if (!state.currentExamSlot) return;
      const classId = document.getElementById('examClass').value;
      const subjectId = document.getElementById('examSubject').value;
      const invigilator = (document.getElementById('examInvigilator').value || '').trim();
      const supervisor = (document.getElementById('examSupervisor').value || '').trim();
      if (!classId || !subjectId) { showToast('Select class and subject'); return; }
      if (!invigilator) { showToast('Select an invigilator'); return; }
      if (!supervisor) { showToast('Select a supervisor for the whole class (all arms)'); return; }

      const { day, slotId } = state.currentExamSlot;
      const exists = (state.exams || []).find(e =>
        e.day === day && e.slotId === slotId && e.classId === classId && e.subjectId === subjectId
      );
      if (exists) {
        exists.invigilator = invigilator;
        exists.supervisor = supervisor;
        showToast('Exam session updated');
      pushHistory();
      } else {
        if (!state.exams) state.exams = [];
        state.exams.push({
          id: 'ex' + Date.now() + Math.random().toString(36).slice(2, 6),
          day, slotId, classId, subjectId, invigilator, supervisor
        });
        showToast('Exam / CA session added');
      pushHistory();
      }
      renderExamExisting();
      renderTable();
      updateExamConflicts();
      checkExamClashPreview();
    }

    function removeExamSession(id) {
      state.exams = (state.exams || []).filter(e => e.id !== id);
      renderExamExisting();
      renderTable();
      updateExamConflicts();
      checkExamClashPreview();
      showToast('Session removed');
      pushHistory();
    }

    function clearExams() {
      if (!confirm('Clear all Exam / CA sessions?')) return;
      state.exams = [];
      renderTable();
      updateExamConflicts();
      showToast('Exam timetable cleared');
      pushHistory();
    }

    function closeExamAutoGenModal() {
      const m = document.getElementById('examAutoGenModal');
      if (m) m.classList.remove('open');
    }

    function getExamClassGroupList() {
      const seen = {};
      const list = [];
      (state.classes || []).forEach(function (c) {
        const base = (typeof getClassArmBase === 'function' && getClassArmBase(c.name)) || c.id;
        const key = String(base).toLowerCase();
        if (seen[key]) {
          seen[key].classIds.push(c.id);
          seen[key].names.push(c.name);
          return;
        }
        seen[key] = { base: base, key: key, classIds: [c.id], names: [c.name] };
        list.push(seen[key]);
      });
      return list;
    }

    function openExamAutoGenModal() {
      if (!state.classes.length) { showToast('Add classes (arms) first'); return; }
      if (!state.subjects.length) { showToast('Add subjects first'); return; }
      if (!state.examSlots) state.examSlots = [];
      const teachingSlots = state.examSlots.filter(s => !s.isBreak);
      if (!teachingSlots.length) { showToast('Add Exam/CA sessions in the sidebar first'); return; }
      const teachers = getUniqueTeachers();
      if (teachers.length < 1) { showToast('Need teachers on subjects for duties'); return; }
      const examDayNames = getExamSchedule().map(r => examDayKey(r));
      if (!examDayNames.length) {
        showToast('Select Exam/CA days in the sidebar first');
        return;
      }

      const groups = getExamClassGroupList();
      const host = document.getElementById('examAutoGenSupervisorList');
      if (!host) return;
      let html = '<div style="font-size:0.78rem;font-weight:700;color:#334155;margin-bottom:8px;">Supervisors by class</div>';
      groups.forEach(function (g, idx) {
        const label = g.names.length > 1
          ? (g.names[0].replace(/[A-Za-z]$/, '').trim() || g.base) + ' (' + g.names.join(', ') + ')'
          : g.names[0];
        html += '<div class="form-group" style="margin-bottom:10px;">' +
          '<label style="font-size:0.78rem;">' + escapeHtml(label) + '</label>' +
          '<select class="exam-autogen-sup" data-group-key="' + escapeHtml(g.key) + '" style="width:100%;">' +
          '<option value="">Auto (pick free teacher)</option>' +
          teachers.map(function (t) {
            return '<option value="' + escapeHtml(t) + '">' + escapeHtml(t) + '</option>';
          }).join('') +
          '</select></div>';
      });
      host.innerHTML = html;
      const modal = document.getElementById('examAutoGenModal');
      if (modal) modal.classList.add('open');
    }

    function confirmExamAutoGenerate() {
      const preferred = {};
      document.querySelectorAll('.exam-autogen-sup').forEach(function (sel) {
        const key = sel.getAttribute('data-group-key') || '';
        const val = (sel.value || '').trim();
        if (key && val) preferred[key] = val;
      });
      closeExamAutoGenModal();
      autoGenerateExamTimetable(preferred);
    }

    function autoGenerateExamTimetable(preferredSupervisors) {
      if (!state.classes.length) { showToast('Add classes (arms) first'); return; }
      if (!state.subjects.length) { showToast('Add subjects first'); return; }
      if (!state.examSlots) state.examSlots = [];
      const teachingSlots = state.examSlots.filter(s => !s.isBreak);
      if (!teachingSlots.length) { showToast('Add Exam/CA sessions in the sidebar first'); return; }
      const teachers = getUniqueTeachers();
      if (teachers.length < 1) { showToast('Need teachers on subjects for duties'); return; }

      if (preferredSupervisors === undefined) {
        openExamAutoGenModal();
        return;
      }

      const preferred = preferredSupervisors || {};
      if (!confirm(
        'This will clear existing Exam/CA sessions and generate fresh.\n\n' +
        '• 1 supervisor per class for the WHOLE exam day (all arms)\n' +
        '• 1 invigilator per arm for the WHOLE exam day\n\nContinue?'
      )) return;

      state.exams = [];
      const demands = [];
      state.classes.forEach(c => {
        state.subjects.forEach(s => {
          const need = getWeeklyFor(s.id, c.id);
          if (need > 0) demands.push({ classId: c.id, subjectId: s.id });
        });
      });
      if (!demands.length) {
        state.classes.forEach(c => {
          state.subjects.forEach(s => demands.push({ classId: c.id, subjectId: s.id }));
        });
      }

      let teacherIdx = 0;
      function nextTeacher(excludeList) {
        if (!teachers.length) return '';
        const excludes = (excludeList || []).map(function (x) {
          return String(x || '').toLowerCase().trim();
        }).filter(Boolean);
        for (let i = 0; i < teachers.length; i++) {
          const t = teachers[teacherIdx % teachers.length];
          teacherIdx++;
          if (excludes.indexOf(String(t).toLowerCase().trim()) < 0) return t;
        }
        return teachers[0] || '';
      }

      // People already committed for the day (whole-day duties)
      // day -> { supervisors: { baseKey: name }, invigilators: { classId: name }, used: { nameLower: true } }
      const dayDuty = {};
      function dutyForDay(day) {
        if (!dayDuty[day]) dayDuty[day] = { supervisors: {}, invigilators: {}, used: {} };
        return dayDuty[day];
      }
      function markUsed(day, name) {
        if (!name) return;
        dutyForDay(day).used[name.toLowerCase().trim()] = true;
      }
      function isUsed(day, name) {
        if (!name) return false;
        return !!dutyForDay(day).used[name.toLowerCase().trim()];
      }

      let placed = 0;
      let failed = 0;

      const examDayNames = getExamSchedule().map(r => examDayKey(r));
      if (!examDayNames.length) {
        showToast('Select Exam/CA days in the sidebar first');
        return;
      }

      // Group demands by class-arm family + subject
      const groups = {};
      demands.forEach(function (d) {
        const cls = state.classes.find(function (c) { return c.id === d.classId; });
        const base = (typeof getClassArmBase === 'function' && getClassArmBase(cls && cls.name)) || d.classId;
        const gkey = String(base).toLowerCase() + '|' + d.subjectId;
        if (!groups[gkey]) groups[gkey] = { subjectId: d.subjectId, base: base, baseKey: String(base).toLowerCase(), classIds: [] };
        if (groups[gkey].classIds.indexOf(d.classId) < 0) groups[gkey].classIds.push(d.classId);
      });

      Object.keys(groups).forEach(function (gkey) {
        const g = groups[gkey];
        const subjectTeacher = (state.subjects.find(function (s) { return s.id === g.subjectId; }) || {}).teacher || '';
        let foundDay = null;
        let foundSlotId = null;

        outer:
        for (let di = 0; di < examDayNames.length; di++) {
          const day = examDayNames[di];
          for (let si = 0; si < teachingSlots.length; si++) {
            const slot = teachingSlots[si];
            const armBusy = g.classIds.some(function (cid) {
              return (state.exams || []).some(function (e) {
                return e.day === day && e.slotId === slot.id && e.classId === cid;
              });
            });
            if (armBusy) continue;

            const dd = dutyForDay(day);

            // Supervisor for this class group — fixed for the whole day
            let sup = dd.supervisors[g.baseKey] || '';
            if (!sup) {
              const prefSup = preferred[g.baseKey] || preferred[g.base] || '';
              if (prefSup && !isUsed(day, prefSup)) {
                sup = prefSup;
              } else {
                sup = nextTeacher([subjectTeacher].concat(Object.keys(dd.used)));
                let tries = 0;
                while (sup && isUsed(day, sup) && tries < teachers.length + 3) {
                  sup = nextTeacher([subjectTeacher, sup].concat(Object.keys(dd.used)));
                  tries++;
                }
              }
              if (!sup || isUsed(day, sup)) continue;
            }

            // Invigilator per arm — fixed for the whole day
            const invs = [];
            let invOk = true;
            for (let ai = 0; ai < g.classIds.length; ai++) {
              const cid = g.classIds[ai];
              let inv = dd.invigilators[cid] || '';
              if (!inv) {
                inv = nextTeacher([subjectTeacher, sup].concat(invs).concat(Object.keys(dd.used)));
                let t2 = 0;
                while (inv && (isUsed(day, inv) || inv.toLowerCase() === (sup || '').toLowerCase() ||
                  invs.some(function (x) { return x.toLowerCase() === inv.toLowerCase(); })) && t2 < teachers.length + 3) {
                  inv = nextTeacher([subjectTeacher, sup, inv].concat(invs).concat(Object.keys(dd.used)));
                  t2++;
                }
                if (!inv || isUsed(day, inv)) { invOk = false; break; }
              }
              invs.push(inv);
            }
            if (!invOk || invs.length !== g.classIds.length) continue;

            foundDay = day;
            foundSlotId = slot.id;
            g._invs = invs;
            g._sup = sup;
            break outer;
          }
        }

        if (!foundDay || !g._sup) {
          failed += g.classIds.length;
          return;
        }

        const dd = dutyForDay(foundDay);
        dd.supervisors[g.baseKey] = g._sup;
        markUsed(foundDay, g._sup);
        g.classIds.forEach(function (classId, idx) {
          const inv = g._invs[idx];
          dd.invigilators[classId] = inv;
          markUsed(foundDay, inv);
          state.exams.push({
            id: 'ex' + Date.now() + '_' + Math.random().toString(36).slice(2, 7) + '_' + idx,
            day: foundDay,
            slotId: foundSlotId,
            classId: classId,
            subjectId: g.subjectId,
            invigilator: inv,
            supervisor: g._sup
          });
          placed++;
        });
      });

      if (PAGE_VIEW !== 'exam') {
        /* PAGES: exams are shown on the Exam page */
        const msg0 = 'Exam/CA generated: ' + placed + ' sessions' +
          (failed ? (', ' + failed + ' could not be placed') : '') +
          ' · whole-day supervisor per class, whole-day invigilator per arm';
        pushHistory();
        if (failed) alert(msg0 + '\n\nAdd more periods, days, or teachers and try again.');
        try { sessionStorage.setItem('akeemPendingToast', msg0); } catch (e) {}
        goToPage('exam');
        return;
      }
      switchView('exam');
      renderTable();
      updateExamConflicts();
      const msg = 'Exam/CA generated: ' + placed + ' sessions' +
        (failed ? (', ' + failed + ' could not be placed') : '') +
        ' · whole-day supervisor per class, whole-day invigilator per arm';
      showToast(msg);
      pushHistory();
      if (failed) alert(msg + '\n\nAdd more periods, days, or teachers and try again.');
    }

    function onPrintSubjectStyleChange(val) {
      state.printSubjectStyle = (val === 'plain') ? 'plain' : 'color';
      const sel = document.getElementById('printSubjectStyle');
      if (sel) sel.value = state.printSubjectStyle;
      if (typeof autosaveNow === 'function') autosaveNow();
      else try { localStorage.setItem('schoolMasterTimetable', JSON.stringify(state)); } catch (e) {}
    }

    function syncPrintSubjectStyleSelect() {
      const sel = document.getElementById('printSubjectStyle');
      if (!sel) return;
      sel.value = (state.printSubjectStyle === 'plain') ? 'plain' : 'color';
    }

    function onPrintBatchSelect(value) {
      const sel = document.getElementById('printBatchSelect');
      if (sel) sel.value = '';
      if (!value) return;
      if (value === 'classes') printBatch('classes');
      else if (value === 'teachers') printBatch('teachers');
    }

    /**
     * Print every class timetable or every teacher timetable in one print job
     * (each on its own page).
     */
    function printBatch(kind) {
      const isClasses = kind === 'classes';
      const list = isClasses
        ? (state.classes || []).slice()
        : ((typeof getUniqueTeachers === 'function') ? getUniqueTeachers() : []);
      if (!list.length) {
        showToast(isClasses ? 'Add classes first' : 'No teachers found — add subjects with teachers');
        return;
      }
      if (!state.slots || !state.slots.filter(s => !s.isBreak).length) {
        showToast('Add teaching periods first');
        return;
      }
      const label = isClasses ? (list.length + ' class timetable' + (list.length > 1 ? 's' : ''))
        : (list.length + ' teacher timetable' + (list.length > 1 ? 's' : ''));
      if (!confirm('Print all ' + label + ' in one job?\n\nEach timetable will start on a new page.\n\nOK = Continue to print dialog\nCancel = Abort')) {
        return;
      }

      const root = document.getElementById('printBatchRoot');
      if (!root) {
        showToast('Print batch container missing');
        return;
      }

      const prevView = state.currentView;
      const prevClass = state.selectedClassId;
      const prevTeacher = state.selectedTeacher;
      const prevZoom = state.zoom;
      state.zoom = 1;
      if (typeof applyZoom === 'function') applyZoom();

      // Ensure indexes for fast multi-render
      if (typeof invalidateLookupCaches === 'function') invalidateLookupCaches();
      if (typeof buildAssignmentIndex === 'function') {
        window._assignIndex = buildAssignmentIndex();
      }
      window._subjectMap = {};
      (state.subjects || []).forEach(s => { window._subjectMap[s.id] = s; });
      window._classMap = {};
      (state.classes || []).forEach(c => { window._classMap[c.id] = c; });
      if (typeof getTeacherClashes === 'function' && typeof buildClashIdSet === 'function') {
        window._clashIdSet = buildClashIdSet(getTeacherClashes());
      }

      state.currentView = isClasses ? 'class' : 'teacher';
      root.innerHTML = '';
      root.setAttribute('aria-hidden', 'false');

      const school = state.schoolName || 'My School';
      const session = (state.session || '').trim();

      list.forEach((item) => {
        if (isClasses) {
          state.selectedClassId = item.id;
          state.selectedTeacher = null;
        } else {
          state.selectedTeacher = item;
          state.selectedClassId = null;
        }

        const section = document.createElement('div');
        section.className = 'print-batch-section';

        // 1) School name (bold, top, center)
        const schoolEl = document.createElement('div');
        schoolEl.className = 'print-batch-school';
        schoolEl.textContent = school;
        section.appendChild(schoolEl);

        // 2) Session under school name (bold, center)
        if (session) {
          const sessEl = document.createElement('div');
          sessEl.className = 'print-batch-session';
          sessEl.textContent = session;
          section.appendChild(sessEl);
        }

        // 3) Class/teacher on the left + period totals on the right
        const sub = document.createElement('div');
        sub.className = 'print-batch-sub';

        const heading = document.createElement('span');
        heading.className = 'print-batch-heading';
        if (isClasses) {
          heading.textContent = 'Class Timetable — ' + (item.name || 'Class');
        } else {
          heading.textContent = 'Teacher Timetable — ' + item;
        }
        sub.appendChild(heading);

        let loadText = '';
        if (isClasses) {
          const load = (typeof getClassPeriodTotals === 'function') ? getClassPeriodTotals(item.id) : null;
          if (load) loadText = load.placed + '/' + load.expected + ' periods';
        } else {
          const load = (typeof getTeacherPeriodTotals === 'function') ? getTeacherPeriodTotals(item) : null;
          if (load) {
            const n = load.cellPlaced || 0;
            loadText = n + (n === 1 ? ' period' : ' periods');
          }
        }
        if (loadText) {
          const perEl = document.createElement('span');
          perEl.className = 'print-batch-periods';
          perEl.textContent = loadText;
          sub.appendChild(perEl);
        }
        section.appendChild(sub);

        const table = document.createElement('table');
        table.className = 'timetable';
        if (typeof renderTableInto === 'function') {
          renderTableInto(table, { noEmptyUi: true });
        }
        section.appendChild(table);
        root.appendChild(section);
      });

      // Restore live view state (screen still shows previous selection after print)
      state.currentView = prevView;
      state.selectedClassId = prevClass;
      state.selectedTeacher = prevTeacher;

      document.body.classList.remove('print-single-timetable', 'print-school-timetable', 'print-compare', 'print-plain-subjects', 'print-batch');
      document.body.classList.add('print-batch', 'print-single-timetable');
      if (state.printSubjectStyle === 'plain') {
        document.body.classList.add('print-plain-subjects');
      }
      // Allow @media print rule to show the batch root
      root.style.display = '';

      showToast('Preparing ' + label + '…');

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.print();
          setTimeout(() => {
            document.body.classList.remove('print-batch', 'print-single-timetable', 'print-plain-subjects');
            root.innerHTML = '';
            root.style.display = 'none';
            root.setAttribute('aria-hidden', 'true');
            state.zoom = prevZoom;
            if (typeof applyZoom === 'function') applyZoom();
            if (typeof renderTable === 'function') renderTable();
            if (typeof updateMeta === 'function') updateMeta();
            showToast('Batch print finished');
          }, 400);
        });
      });
    }

    function printTimetable() {
      const view = state.currentView;

      if (view === 'class' && !state.selectedClassId) {
        showToast('Select a class first to print its timetable');
        return;
      }
      if ((view === 'teacher' || view === 'compare') && !state.selectedTeacher) {
        showToast(view === 'compare'
          ? 'Select a teacher on the right to print side by side'
          : 'Select a teacher first to print their timetable');
        return;
      }
      if ((view === 'school' || view === 'exam' || view === 'compare') && state.classes.length === 0) {
        showToast('Add classes first to print the timetable');
        return;
      }
      if (view === 'exam' && !(state.examSlots || []).length) {
        showToast('Add Exam/CA periods first');
        return;
      }
      if (view !== 'exam' && !state.slots.length) {
        showToast('Add periods first');
        return;
      }

      // Reset zoom so the full table prints without transform clipping
      const prevZoom = state.zoom;
      state.zoom = 1;
      if (typeof applyZoom === 'function') applyZoom();

      // Ensure on-screen table matches the active tab before printing
      renderTable();
      updateMeta();

      const metaEl = document.getElementById('headerMeta');
      const titleEl = document.getElementById('viewTitle');
      const prevMeta = metaEl ? metaEl.textContent : '';
      const prevTitle = titleEl ? titleEl.textContent : '';

      document.body.classList.remove('print-single-timetable', 'print-school-timetable', 'print-compare', 'print-plain-subjects');
      updateMeta(); // pick up latest session text

      if (view === 'school') {
        const load = getSchoolPeriodTotals();
        setViewTitle('School General Timetable — All days & periods', true, load);
        if (metaEl) {
          metaEl.textContent = (state.schoolName || 'My School') + ' · Full school timetable · ' +
            load.placed + '/' + load.expected;
        }
        document.body.classList.add('print-school-timetable');
      } else if (view === 'class') {
        const c = state.classes.find(x => x.id === state.selectedClassId);
        const name = c ? c.name : 'Class';
        const load = (state.showClassLoad !== false && state.selectedClassId)
          ? getClassPeriodTotals(state.selectedClassId) : null;
        setViewTitle('Class Timetable — ' + name, true, load);
        if (metaEl) {
          metaEl.textContent = (state.schoolName || 'My School') + ' · Class: ' + name +
            (load ? (' · ' + load.placed + '/' + load.expected) : '');
        }
        document.body.classList.add('print-single-timetable');
      } else if (view === 'teacher') {
        const load = (state.showTeacherLoad !== false && state.selectedTeacher)
          ? getTeacherPeriodTotals(state.selectedTeacher) : null;
        setViewTitle('Teacher Timetable — ' + (state.selectedTeacher || 'Teacher'), true, load);
        if (metaEl) {
          // Print meta: only unique cell count, e.g. "12 periods"
          const n = load ? (load.cellPlaced || 0) : 0;
          const cellOnly = load ? (n + (n === 1 ? ' period' : ' periods')) : '';
          metaEl.textContent = (state.schoolName || 'My School') + ' · Teacher: ' + state.selectedTeacher +
            (cellOnly ? (' · ' + cellOnly) : '');
        }
        document.body.classList.add('print-single-timetable');
      } else if (view === 'compare') {
        const load = getTeacherPeriodTotals(state.selectedTeacher);
        setViewTitle('School General + Teacher — ' + state.selectedTeacher, true, load);
        if (metaEl) {
          const n = load ? (load.cellPlaced || 0) : 0;
          const cellOnly = load ? (n + (n === 1 ? ' period' : ' periods')) : '';
          metaEl.textContent = (state.schoolName || 'My School') + ' · Side by side · ' +
            (cellOnly || '');
        }
        document.body.classList.add('print-compare');
      } else if (view === 'exam') {
        setViewTitle('Exam / CA Timetable — Invigilators & Supervisors', true);
        if (metaEl) metaEl.textContent = (state.schoolName || 'My School') + ' · Exam / Continuous Assessment';
      }

      if (view === 'class' || view === 'teacher' || view === 'school') {
        prepareSinglePagePrintScale();
      } else {
        document.documentElement.style.removeProperty('--print-scale');
      }

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (view === 'class' || view === 'teacher' || view === 'school') {
            prepareSinglePagePrintScale();
          }
          if (state.printSubjectStyle === 'plain') {
            document.body.classList.add('print-plain-subjects');
          } else {
            document.body.classList.remove('print-plain-subjects');
          }
          window.print();
          setTimeout(() => {
            document.body.classList.remove('print-single-timetable', 'print-school-timetable', 'print-compare', 'print-plain-subjects');
            document.documentElement.style.removeProperty('--print-scale');
            const scaleEl = document.getElementById('timetableScale');
            if (scaleEl) {
              scaleEl.style.transform = '';
              scaleEl.style.width = '';
            }
            state.zoom = prevZoom;
            if (typeof applyZoom === 'function') applyZoom();
            if (metaEl) metaEl.textContent = prevMeta;
            if (titleEl) {
              titleEl.textContent = prevTitle;
            }
            updateMeta();
            renderTable();
          }, 300);
        });
      });
    }

    function prepareSinglePagePrintScale() {
      const table = document.getElementById('timetable');
      const scaleEl = document.getElementById('timetableScale');
      if (!table || !scaleEl) {
        document.documentElement.style.setProperty('--print-scale', '1');
        return;
      }
      // Clear any previous transform so we measure natural size
      scaleEl.style.transform = '';
      scaleEl.style.width = '';
      scaleEl.style.zoom = '';
      document.documentElement.style.setProperty('--print-scale', '1');

      // Force layout, then measure full table
      void table.offsetWidth;
      const wPx = Math.max(table.scrollWidth, table.offsetWidth, 1);
      let hPx = Math.max(table.scrollHeight, table.offsetHeight, 1);

      const isSchool = document.body.classList.contains('print-school-timetable');
      const isSingle = document.body.classList.contains('print-single-timetable');

      // Include title / school name so they stay on the same page as the grid
      if (isSchool || isSingle) {
        const header = document.querySelector('header');
        const toolbar = document.querySelector('.toolbar');
        const extra =
          (header ? header.offsetHeight : 0) +
          (toolbar ? toolbar.offsetHeight : 0) +
          16;
        hPx = hPx + extra;
      }

      // Landscape printable area (A4 landscape minus margins)
      const pageWmm = 285;
      const pageHmm = isSchool ? 190 : 188;
      const pxPerMm = 96 / 25.4;
      const maxW = pageWmm * pxPerMm;
      const maxH = pageHmm * pxPerMm;

      let scale = Math.min(1, maxW / wPx, maxH / hPx);

      // Print CSS often enlarges fonts/padding vs on-screen measure — pad scale down
      if (isSchool) {
        scale = scale * 0.92;
      } else if (isSingle) {
        // Class / Teacher: always force one page even if cells were stretched on screen
        scale = scale * 0.88;
      }

      // Class/Teacher: allow smaller scale so stretched grids still fit one page
      const minScale = isSchool ? 0.15 : (isSingle ? 0.2 : 0.35);
      if (scale < minScale) scale = minScale;
      if (scale > 1) scale = 1;
      scale = Math.round(scale * 1000) / 1000;
      document.documentElement.style.setProperty('--print-scale', String(scale));
    }



    function togglePerDayTimes(enabled) {
      state.usePerDayTimes = !!enabled;
      const toggle1 = document.getElementById('usePerDayTimesToggle');
      const toggle2 = document.getElementById('dayTimesUsePerDay');
      if (toggle1) toggle1.checked = state.usePerDayTimes;
      if (toggle2) toggle2.checked = state.usePerDayTimes;
      renderTable();
      renderSlots();
      if (typeof saveToStorage === 'function') saveToStorage();
    }

    function openDaySlotTimesModal() {
      const modal = document.getElementById('daySlotTimesModal');
      if (!modal) return;
      const chk = document.getElementById('dayTimesUsePerDay');
      if (chk) chk.checked = !!state.usePerDayTimes;
      renderDaySlotTimesGrid();
      modal.classList.add('open');
    }

    function closeDaySlotTimesModal() {
      const modal = document.getElementById('daySlotTimesModal');
      if (modal) modal.classList.remove('open');
    }

    function renderDaySlotTimesGrid() {
      const container = document.getElementById('daySlotTimesGrid');
      if (!container) return;
      const teachingSlots = state.slots.filter(s => !s.isBreak);
      let html = '<table style="width:100%;border-collapse:collapse;font-size:0.8rem;"><thead><tr><th style="position:sticky;left:0;background:#f8fafc;padding:8px;border:1px solid #e2e8f0;min-width:70px;">Day / Period</th>';
      teachingSlots.forEach(slot => {
        html += '<th style="padding:6px;border:1px solid #e2e8f0;background:#eef2ff;text-align:center;min-width:130px;">' + escapeHtml(slot.label) + '<br><span style="font-size:0.68rem;color:#64748b;">' + escapeHtml((slot.start||'') + '-' + (slot.end||'')) + ' default</span></th>';
      });
      html += '</tr></thead><tbody>';
      state.days.forEach(day => {
        html += '<tr><td style="position:sticky;left:0;background:#f8fafc;padding:8px;border:1px solid #e2e8f0;font-weight:700;">' + escapeHtml(day) + '</td>';
        teachingSlots.forEach(slot => {
          const custom = (state.daySlotTimes && state.daySlotTimes[day] && state.daySlotTimes[day][slot.id]) ? state.daySlotTimes[day][slot.id] : { start: '', end: '' };
          html += '<td style="padding:4px;border:1px solid #e2e8f0;"><div style="display:flex;gap:4px;align-items:center;">' +
            '<input type="time" data-day="' + escapeHtml(day) + '" data-slot="' + escapeHtml(slot.id) + '" data-field="start" value="' + escapeHtml(custom.start || '') + '" style="width:85px;padding:4px;font-size:0.75rem;border:1px solid #cbd5e1;border-radius:4px;" />' +
            '<span style="font-size:0.7rem;">-</span>' +
            '<input type="time" data-day="' + escapeHtml(day) + '" data-slot="' + escapeHtml(slot.id) + '" data-field="end" value="' + escapeHtml(custom.end || '') + '" style="width:85px;padding:4px;font-size:0.75rem;border:1px solid #cbd5e1;border-radius:4px;" />' +
            '</div></td>';
        });
        html += '</tr>';
      });
      html += '</tbody></table>';
      container.innerHTML = html;
    }

    function saveDaySlotTimes() {
      const inputs = document.querySelectorAll('#daySlotTimesGrid input[type="time"]');
      const newTimes = {};
      inputs.forEach(inp => {
        const day = inp.getAttribute('data-day');
        const slotId = inp.getAttribute('data-slot');
        const field = inp.getAttribute('data-field');
        const val = inp.value.trim();
        if (!val) return; // keep blank as default
        if (!newTimes[day]) newTimes[day] = {};
        if (!newTimes[day][slotId]) newTimes[day][slotId] = {};
        newTimes[day][slotId][field] = val;
      });
      // Merge with existing, but remove empty entries
      state.daySlotTimes = newTimes;
      const chk = document.getElementById('dayTimesUsePerDay');
      if (chk) state.usePerDayTimes = chk.checked;
      const toggle1 = document.getElementById('usePerDayTimesToggle');
      if (toggle1) toggle1.checked = state.usePerDayTimes;
      closeDaySlotTimesModal();
      renderTable();
      renderSlots();
      if (typeof saveToStorage === 'function') saveToStorage();
      if (typeof pushHistory === 'function') pushHistory();
      showToast(state.usePerDayTimes ? 'Per-day times saved & enabled' : 'Per-day times saved (disabled)');
    }

    function copyDayTimes(fromDay) {
      if (!state.daySlotTimes[fromDay]) { showToast('No custom times set for ' + fromDay); return; }
      state.days.forEach(d => {
        if (d === fromDay) return;
        state.daySlotTimes[d] = JSON.parse(JSON.stringify(state.daySlotTimes[fromDay]));
      });
      renderDaySlotTimesGrid();
      showToast('Copied ' + fromDay + ' times to all days');
    }

    function clearAllDayTimes() {
      if (!confirm('Clear all per-day custom times and use default period times for all days?')) return;
      state.daySlotTimes = {};
      renderDaySlotTimesGrid();
      showToast('Cleared all per-day times');
    }


    function escapeHtml(str) {
      if (!str) return '';
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // ===== App sounds (Web Audio — no external files, works offline / PWA) =====
    let _audioCtx = null;
    let _audioUnlocked = false;

    function isSoundEnabled() {
      if (state && state.soundEnabled === false) return false;
      try {
        if (localStorage.getItem('akeemTimetableSound') === '0') return false;
      } catch (e) {}
      return true;
    }

    function toggleAppSound(on) {
      state.soundEnabled = !!on;
      try { localStorage.setItem('akeemTimetableSound', on ? '1' : '0'); } catch (e) {}
      if (typeof autosaveNow === 'function') autosaveNow();
      if (on) playAppSound('success');
      else showToast('Sound off');
    }

    function syncSoundToggle() {
      const el = document.getElementById('soundEnabledToggle');
      if (el) el.checked = isSoundEnabled();
    }

    function unlockAudio() {
      if (_audioUnlocked) return;
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        if (!_audioCtx) _audioCtx = new Ctx();
        if (_audioCtx.state === 'suspended') _audioCtx.resume();
        _audioUnlocked = true;
      } catch (e) {}
    }

    function playAppSound(kind) {
      if (!isSoundEnabled()) return;
      try {
        unlockAudio();
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        if (!_audioCtx) _audioCtx = new Ctx();
        if (_audioCtx.state === 'suspended') _audioCtx.resume();
        const ctx = _audioCtx;
        const now = ctx.currentTime;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        g.gain.setValueAtTime(0.0001, now);

        if (kind === 'error' || kind === 'fail') {
          o.type = 'triangle';
          o.frequency.setValueAtTime(200, now);
          o.frequency.linearRampToValueAtTime(140, now + 0.18);
          g.gain.exponentialRampToValueAtTime(0.14, now + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
          o.start(now);
          o.stop(now + 0.3);
        } else if (kind === 'warn' || kind === 'clash') {
          o.type = 'sine';
          o.frequency.setValueAtTime(440, now);
          o.frequency.setValueAtTime(440, now + 0.08);
          o.frequency.setValueAtTime(330, now + 0.1);
          g.gain.exponentialRampToValueAtTime(0.1, now + 0.015);
          g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
          o.start(now);
          o.stop(now + 0.24);
        } else if (kind === 'click') {
          o.type = 'sine';
          o.frequency.setValueAtTime(800, now);
          g.gain.exponentialRampToValueAtTime(0.06, now + 0.005);
          g.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
          o.start(now);
          o.stop(now + 0.07);
        } else {
          // success / default — two soft rising notes
          o.type = 'sine';
          o.frequency.setValueAtTime(523.25, now);
          o.frequency.setValueAtTime(659.25, now + 0.07);
          g.gain.exponentialRampToValueAtTime(0.11, now + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
          o.start(now);
          o.stop(now + 0.25);
        }
      } catch (e) {}
    }

    function showToast(msg, soundKind) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 2500);
      // Auto-pick sound from message if not specified
      if (soundKind === false || soundKind === 'none') return;
      const m = String(msg || '').toLowerCase();
      let kind = soundKind;
      if (!kind) {
        if (/cannot|failed|error|required|not found|abort|stop|blocked/.test(m)) kind = 'error';
        else if (/clash|conflict|warning|⚠️|locked/.test(m)) kind = 'warn';
        else if (/deleted|removed|cleared/.test(m)) kind = 'click';
        else kind = 'success';
      }
      playAppSound(kind);
    }

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        closeSlotModal();
        closeClassModal();
        closeSubjectModal();
        closeAssignModal();
        if (typeof closeExamModal === 'function') closeExamModal();
        if (typeof closeAutoGenModal === 'function') closeAutoGenModal();
        if (typeof closeStudySubjectModal === 'function') closeStudySubjectModal();
        if (typeof closeStudyAssignModal === 'function') closeStudyAssignModal();
      }
      // Undo / Redo — skip when typing in inputs
      const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
      const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target && e.target.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && !typing) {
        if (e.key === 'z' || e.key === 'Z') {
          if (e.shiftKey) {
            e.preventDefault();
            redo();
          } else {
            e.preventDefault();
            undo();
          }
        } else if (e.key === 'y' || e.key === 'Y') {
          e.preventDefault();
          redo();
        }
      }
    });

    // Click outside (on the dimmed overlay) closes the open dialog
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', function (e) {
        if (e.target !== overlay) return; // ignore clicks inside the dialog panel
        const id = overlay.id;
        if (id === 'slotModal') closeSlotModal();
        else if (id === 'classModal') closeClassModal();
        else if (id === 'subjectModal') closeSubjectModal();
        else if (id === 'assignModal') closeAssignModal();
        else if (id === 'examModal' && typeof closeExamModal === 'function') closeExamModal();
        else if (id === 'autoGenModal' && typeof closeAutoGenModal === 'function') closeAutoGenModal();
        else overlay.classList.remove('open');
      });
    });


    // Warn before closing / refreshing if there are unsaved changes
    window.addEventListener('beforeunload', function (e) {
      if (!isTimetableDirty()) return;
      // Modern browsers show a generic Leave / Cancel dialog (custom text is ignored)
      e.preventDefault();
      e.returnValue = 'You have unsaved changes. Save before leaving?';
      return e.returnValue;
    });

    /** Confirm leaving with unsaved work. Returns true if OK to proceed. */
    function confirmLeaveIfDirty(actionLabel) {
      if (!isTimetableDirty()) return true;
      const label = actionLabel || 'continue';
      return confirm(
        'You have unsaved changes.\\n\\n' +
        '• OK — ' + label + ' without saving\\n' +
        '• Cancel — stay here so you can Save first'
      );
    }

    /* =====================================================================
       PAGES — each view of the app is its own HTML page (see <body data-page>).
       All pages share styles.css, app.js and the same saved data.
       ===================================================================== */
    const PAGE_VIEW = (document.body && document.body.dataset.page) || 'school';
    const PAGE_URLS = {
      school:  'index.html',
      class:   'class.html',
      teacher: 'teacher.html',
      compare: 'compare.html',
      exam:    'exam.html',
      study:   'reading.html'
    };

    /* On a dedicated page, any request to "switch view" simply renders this page's own view.
       (Real page changes go through goToPage.) */
    const _switchViewOriginal = switchView;
    switchView = function (view) {
      return _switchViewOriginal(PAGE_VIEW);
    };

    /* Save silently, then open another page. */
    function goToPage(view) {
      const url = PAGE_URLS[view];
      if (!url || view === PAGE_VIEW) return;
      try {
        localStorage.setItem('schoolMasterTimetable', JSON.stringify(state));
        lastSavedSnap = snapshotHistory();
        lastSaveAt = Date.now();
        lastSaveFailed = false;
      } catch (e) {}
      if (typeof closeMobileSidebar === 'function') { try { closeMobileSidebar(); } catch (e) {} }
      window.location.href = url;
    }

    /* Back/forward cache: never show a stale copy of the data. */
    window.addEventListener('pageshow', function (ev) {
      if (ev.persisted) window.location.reload();
    });


    init();

    /* PAGES: things handed over from the previous page */
    (function () {
      try {
        const toast = sessionStorage.getItem('akeemPendingToast');
        if (toast) { sessionStorage.removeItem('akeemPendingToast'); setTimeout(function () { showToast(toast); }, 200); }
        const jump = sessionStorage.getItem('akeemPendingJump');
        if (jump) {
          sessionStorage.removeItem('akeemPendingJump');
          const j = JSON.parse(jump);
          setTimeout(function () {
            const card = document.getElementById('conflictsCard');
            if (card && card.classList.contains('collapsed') && typeof setSidebarCardCollapsed === 'function') {
              setSidebarCardCollapsed('conflictsCard', false);
            }
            navigateToPlacement(j.day, j.slotId, j.classId || null);
          }, 150);
        }
      } catch (e) {}
    })();
  
    document.addEventListener('keydown', function(e){
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase()==='s'){
        e.preventDefault();
        if (typeof saveTimetableNow === 'function') saveTimetableNow();
      }
    });

