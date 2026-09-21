    // PWA service worker — only on http(s), never on file:// or content://
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        try {
          var protocol = location.protocol || '';
          if (protocol !== 'http:' && protocol !== 'https:') return;
          var swUrl = new URL('sw.js', location.href).href;
          navigator.serviceWorker.register(swUrl, { scope: './' })
            .then(function (reg) { console.log('SW registered:', reg.scope); })
            .catch(function (err) { console.log('SW failed:', err); });
        } catch (e) {
          console.log('SW skip:', e);
        }
      });
    }
  
    /* ===== Drag & Drop with Move/Copy prompt - works in all timetables ===== */
    window._draggedData = null;
    window._dropTarget = null;
    window._touchDrag = null;


    function handleEntryHoldStart(e){
      const el = e.target.closest ? e.target.closest('.entry') : e.target;
      if (!el) return;
      el.classList.add('hold-pending');
      const id = el.getAttribute('data-assign-id') || Math.random().toString(36).slice(2);
      // clear previous
      if (window._dragHoldTimers.has(id)) clearTimeout(window._dragHoldTimers.get(id));
      const timer = setTimeout(()=>{
        el.classList.remove('hold-pending');
        el.classList.add('hold-ready');
        window._dragHoldReady.set(el, true);
        showToast('✓ Ready to drag — now drag');
        // vibrate if available
        if (navigator.vibrate) navigator.vibrate(50);
        // auto remove ready after 3 sec if not dragged
        setTimeout(()=>{ 
          window._dragHoldReady.delete(el); 
          el.classList.remove('hold-ready');
        }, 3000);
      }, 1000);
      window._dragHoldTimers.set(id, timer);
      
      function cancelHold(){
        clearTimeout(timer);
        window._dragHoldTimers.delete(id);
        el.classList.remove('hold-pending');
        el.removeEventListener('mouseup', cancelHold);
        el.removeEventListener('mouseleave', cancelHold);
        el.removeEventListener('touchend', cancelHold);
        el.removeEventListener('touchcancel', cancelHold);
      }
      el.addEventListener('mouseup', cancelHold, {once:true});
      el.addEventListener('mouseleave', cancelHold, {once:true});
      el.addEventListener('touchend', cancelHold, {once:true});
      el.addEventListener('touchcancel', cancelHold, {once:true});
    }

    // Attach hold listeners to entries via delegation
    document.addEventListener('mousedown', function(e){
      const entry = e.target.closest && e.target.closest('.entry');
      if (entry && entry.closest('table.timetable')) handleEntryHoldStart(e);
    }, true);
    document.addEventListener('touchstart', function(e){
      const entry = e.target.closest && e.target.closest('.entry');
      if (entry && entry.closest('table.timetable')) handleEntryHoldStart(e);
    }, {passive:true, capture:true});

    window._dragHoldReady = window._dragHoldReady || new WeakMap();
    window._dragHoldTimers = window._dragHoldTimers || new Map();

    function handleEntryDragStart(e) {
      const target = e.target.closest ? e.target.closest('.entry') : e.target;
      // Require 2-second hold
      if (!window._dragHoldReady.get(target)) {
        e.preventDefault();
        showToast('Hold for 1 second to drag');
        return;
      }
      // clear hold flag after use
      window._dragHoldReady.delete(target);

      const el = e.currentTarget || e.target.closest('.entry');
      if (!el) return;
      const dragId0 = el.getAttribute('data-assign-id');
      if (dragId0) {
        const a0 = state.assignments.find(x => x.id === dragId0);
        if (assignmentIsLocked(a0)) {
          e.preventDefault();
          showToast('🔒 Locked — unlock in the edit dialog first');
          return;
        }
      }
      const cell = el.closest('td.slot');
      let assignIds = [];
      let sourceDay = el.getAttribute('data-day');
      let sourceSlot = el.getAttribute('data-slot-id');
      let sourceClass = el.getAttribute('data-class-id');
      
      // If cell has multiple assignments (group), drag whole group
      if (cell) {
        const cellIds = (cell.getAttribute('data-assign-ids') || '').split(',').map(s=>s.trim()).filter(Boolean);
        if (cellIds.length > 1) {
          // dragging group - if dragged entry belongs to that cell, drag all
          if (cellIds.includes(el.getAttribute('data-assign-id'))) {
            assignIds = cellIds;
          } else {
            assignIds = [el.getAttribute('data-assign-id')].filter(Boolean);
          }
        } else {
          assignIds = [el.getAttribute('data-assign-id')].filter(Boolean);
        }
        if (!sourceDay) sourceDay = cell.getAttribute('data-day');
        if (!sourceSlot) sourceSlot = cell.getAttribute('data-slot-id');
        if (!sourceClass) sourceClass = cell.getAttribute('data-class-id');
      } else {
        assignIds = [el.getAttribute('data-assign-id')].filter(Boolean);
      }

      if (!assignIds.length) return;
      window._draggedData = {
        assignIds: assignIds,
        day: sourceDay,
        slotId: sourceSlot,
        classId: sourceClass,
        sourceCell: cell
      };
      el.classList.add('dragging');
      if (cell) cell.classList.add('drag-source');
      e.dataTransfer.effectAllowed = 'copyMove';
      e.dataTransfer.setData('text/plain', assignIds.join(','));
      // custom drag image
      try {
        const ghost = el.cloneNode(true);
        ghost.style.position = 'absolute';
        ghost.style.top = '-1000px';
        ghost.style.width = el.offsetWidth + 'px';
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, el.offsetWidth/2, 20);
        setTimeout(()=>ghost.remove(), 0);
      } catch(err){}
    }

    function handleEntryDragEnd(e) {
      const el = e.currentTarget || e.target.closest('.entry');
      if (el) el.classList.remove('dragging');
      document.querySelectorAll('td.slot.drag-over').forEach(td=>td.classList.remove('drag-over')); document.querySelectorAll('td.slot.drag-over-blocked').forEach(td=>td.classList.remove('drag-over-blocked'));
      document.querySelectorAll('td.slot.drag-source').forEach(td=>td.classList.remove('drag-source'));
    }

    function getSlotTargetInfo(cell) {
      if (!cell) return null;
      if (cell.classList.contains('break-slot') || cell.classList.contains('jumat-slot')) return null;
      const day = cell.getAttribute('data-day');
      const slotId = cell.getAttribute('data-slot-id');
      if (!day || !slotId) return null;
      let classId = cell.getAttribute('data-class-id');
      // For class view, use selected class
      if (!classId && state.currentView === 'class') classId = state.selectedClassId;
      // For teacher view or side-by-side right, classId may be from dragged data (keep original)
      return { day, slotId, classId: classId || null, element: cell };
    }

    
    function isQuotaExceededForDrop(target) {
      if (!window._draggedData || !target) return false;
      if (typeof getQuotaFor !== 'function' || typeof countSubjectForClass !== 'function') return false;
      const srcIds = window._draggedData.assignIds;
      const assignments = srcIds.map(id=>state.assignments.find(a=>a.id===id)).filter(Boolean);
      for (const a of assignments) {
        let finalClassId = target.classId || a.classId;
        if (state.currentView === 'class' && state.selectedClassId) finalClassId = state.selectedClassId;
        if (!finalClassId && target.element) finalClassId = target.element.getAttribute('data-class-id') || a.classId;
        // teacher correction
        let corrected = a.subjectId;
        const orig = state.subjects.find(s=>s.id===a.subjectId);
        if (orig) {
          const nameLower = (orig.name||'').toLowerCase().trim();
          const variants = state.subjects.filter(s=> (s.name||'').toLowerCase().trim()===nameLower);
          const targetAssigns = state.assignments.filter(x=>x.classId===finalClassId);
          for (const ta of targetAssigns) {
            const ts = state.subjects.find(s=>s.id===ta.subjectId);
            if (ts && (ts.name||'').toLowerCase().trim()===nameLower) { corrected = ts.id; break; }
          }
        }
        const quota = getQuotaFor(corrected, finalClassId);
        const current = countSubjectForClass(corrected, finalClassId);
        const sameClass = a.classId===finalClassId;
        const effective = sameClass ? current : current + 1;
        if (quota>0 && effective>quota) return true;
      }
      return false;
    }

    function handleSlotDragOver(e) { e.preventDefault(); e.stopPropagation();
      e.preventDefault();
      const cell = e.currentTarget;
      if (!window._draggedData) return;
      const target = getSlotTargetInfo(cell);
      if (!target) return;
      // ignore same cell
      if (target.day === window._draggedData.day && target.slotId === window._draggedData.slotId && (target.classId || window._draggedData.classId) === window._draggedData.classId) {
        return;
      }
      if (isQuotaExceededForDrop(getSlotTargetInfo(cell))) { cell.classList.add('drag-over-blocked'); e.dataTransfer.dropEffect = 'none'; } else { cell.classList.add('drag-over'); e.dataTransfer.dropEffect = 'copyMove'; }
    }

    function handleSlotDragEnter(e){ e.preventDefault(); const cell=e.currentTarget; if(!cell) return; const tgt = getSlotTargetInfo(cell); if (isQuotaExceededForDrop(tgt)) { cell.classList.add('drag-over-blocked'); } else { cell.classList.add('drag-over'); } }
    function handleSlotDragLeave(e) {
      const cell = e.currentTarget;
      // only remove if leaving cell bounds
      const rect = cell.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
        cell.classList.remove('drag-over');
      }
    }

    function handleSlotDrop(e) { e.preventDefault(); e.stopPropagation();
      e.preventDefault();
      const cell = e.currentTarget;
      cell.classList.remove('drag-over');
      document.querySelectorAll('td.slot.drag-source').forEach(td=>td.classList.remove('drag-source'));
      if (!window._draggedData) return;
      const target = getSlotTargetInfo(cell);
      if (!target) return;

      // Prevent dropping onto same location for same class
      const sameSlot = target.day === window._draggedData.day && target.slotId === window._draggedData.slotId;
      if (sameSlot) {
        const srcClass = window._draggedData.classId;
        const tgtClass = target.classId;
        // if class also same or teacher view (class not relevant), ignore
        if (!srcClass || !tgtClass || srcClass === tgtClass) {
          window._draggedData = null;
          return;
        }
      }

      // Check jumat
      const slotObj = state.slots.find(s=>s.id===target.slotId);
      if (slotObj && isJumatCell(target.day, slotObj)) {
        showToast('JUMAT slot is blocked');
        window._draggedData = null;
        return;
      }

      window._dropTarget = target;
      openDragActionModal();
    }

    function openDragActionModal() {
      const src = window._draggedData;
      const tgt = window._dropTarget;
      if (!src || !tgt) return;
      const count = src.assignIds.length;
      const srcSubjs = src.assignIds.map(id=>{
        const a = state.assignments.find(x=>x.id===id);
        if (!a) return '?';
        const subj = state.subjects.find(s=>s.id===a.subjectId);
        const cls = state.classes.find(c=>c.id===a.classId);
        return (cls?cls.name+': ':'') + (subj?subj.name:'subject');
      }).join(', ');
      const tgtSlot = state.slots.find(s=>s.id===tgt.slotId);
      const tgtClass = tgt.classId ? (state.classes.find(c=>c.id===tgt.classId)?.name || tgt.classId) : (state.currentView==='teacher' ? 'same class' : '—');
      const infoEl = document.getElementById('dragActionInfo');
      if (infoEl) {
        infoEl.innerHTML = '<strong>' + count + ' subject' + (count>1?'s':'') + ':</strong> ' + escapeHtml(srcSubjs.substring(0,120)) + (srcSubjs.length>120?'…':'') + '<br>' +
          '<span style="color:#0f172a;">From <b>' + escapeHtml(src.day||'?') + ' · ' + escapeHtml((state.slots.find(s=>s.id===src.slotId)?.label)||'?') + '</b></span><br>' +
          '<span style="color:#0f172a;">To <b>' + escapeHtml(tgt.day) + ' · ' + escapeHtml(tgtSlot?tgtSlot.label:tgt.slotId) + ' · ' + escapeHtml(tgtClass) + '</b></span>';
      }
      const modal = document.getElementById('dragActionModal');
      if (modal) modal.classList.add('open');
    }

    function closeDragActionModal() {
      const modal = document.getElementById('dragActionModal');
      if (modal) modal.classList.remove('open');
      window._dropTarget = null;
      window._draggedData = null;
      document.querySelectorAll('td.slot.drag-over').forEach(td=>td.classList.remove('drag-over')); document.querySelectorAll('td.slot.drag-over-blocked').forEach(td=>td.classList.remove('drag-over-blocked'));
      document.querySelectorAll('td.slot.drag-source').forEach(td=>td.classList.remove('drag-source'));
      document.querySelectorAll('.entry.dragging').forEach(en=>en.classList.remove('dragging'));
    }

            function confirmDragAction(action) {
      const src = window._draggedData;
      const tgt = window._dropTarget;
      console.log('confirmDragAction', action, src, tgt);
      if (!src || !tgt) { closeDragActionModal(); return; }
      if (typeof pushUndo === 'function') { try { pushUndo(); } catch(e){} }

      function getCorrectSubjectIdForTarget(originalSubjectId, targetClassId) {
        const origSubj = state.subjects.find(s=>s.id===originalSubjectId);
        if (!origSubj || !targetClassId) return originalSubjectId;
        const nameLower = (origSubj.name||'').trim().toLowerCase();
        // All subjects with same name (different teachers)
        const sameNameVariants = state.subjects.filter(s=> (s.name||'').trim().toLowerCase() === nameLower);
        // First: if original is already offered for target class (weekly>0), keep it but still try to find better teacher that is already used in target class
        // Find variants that are offered for target class (weekly >0)
        const offeredVariants = sameNameVariants.filter(v=>{
          const w = (typeof getWeeklyFor==='function') ? getWeeklyFor(v.id, targetClassId) : 0;
          const q = (typeof getQuotaFor==='function') ? getQuotaFor(v.id, targetClassId) : 0;
          return w>0 || q>0;
        });
        if (offeredVariants.length===0) {
          // No variant of this subject name is offered for target class -> return null marker to indicate not offered
          return null;
        }
        // If only one offered, use it (auto-correct teacher)
        if (offeredVariants.length===1) return offeredVariants[0].id;
        // Multiple offered: prefer one already used in target class
        const targetClassAssignments = state.assignments.filter(a=>a.classId===targetClassId);
        for (const a of targetClassAssignments) {
          const found = offeredVariants.find(v=>v.id===a.subjectId);
          if (found) return found.id;
        }
        // Prefer teacher who already teaches in target class
        const teachersInTargetClass = new Set();
        targetClassAssignments.forEach(a=>{
          const subj = state.subjects.find(s=>s.id===a.subjectId);
          if (subj && subj.teacher) teachersInTargetClass.add(subj.teacher.trim().toLowerCase());
        });
        for (const variant of offeredVariants) {
          if (variant.teacher && teachersInTargetClass.has(variant.teacher.trim().toLowerCase())) {
            return variant.id;
          }
        }
        // Fallback: first offered variant
        return offeredVariants[0].id;
      }

      const assignmentsToProcess = src.assignIds.map(id=>state.assignments.find(a=>a.id===id)).filter(Boolean);
      if (!assignmentsToProcess.length) { 
        showToast('No assignment found to ' + action);
        closeDragActionModal(); 
        window._draggedData = null;
        window._dropTarget = null;
        return; 
      }

      // --- QUOTA CHECK: prevent over periods + block if class not offering subject ---
      let quotaBlocked = [];
      let neededMap = {};
      assignmentsToProcess.forEach(srcAssign => {
        let finalClassId = tgt.classId || srcAssign.classId;
        if (state.currentView === 'class' && state.selectedClassId) finalClassId = state.selectedClassId;
        if (!finalClassId && tgt.element) finalClassId = tgt.element.getAttribute('data-class-id') || srcAssign.classId;
        const correctedSubjectId = getCorrectSubjectIdForTarget(srcAssign.subjectId, finalClassId);
        const key = finalClassId + '|' + (correctedSubjectId===null ? 'null' : correctedSubjectId);
        neededMap[key] = (neededMap[key]||0) + 1;
      });

      for (const key in neededMap) {
        const [classId, subjectId] = key.split('|');
        const needed = neededMap[key];
        // subjectId may be 'null' string if getCorrectSubjectIdForTarget returned null (not offered)
        if (!subjectId || subjectId==='null' || subjectId==='undefined') {
          // Find original name from assignmentsToProcess that mapped to this
          const origAssign = assignmentsToProcess.find(a=>{
            const corrected = getCorrectSubjectIdForTarget(a.subjectId, classId);
            return !corrected;
          });
          const origSubj = origAssign ? state.subjects.find(s=>s.id===origAssign.subjectId) : null;
          const subjName = origSubj ? origSubj.name : 'Subject';
          const cls = state.classes.find(c=>c.id===classId);
          const clsName = cls ? cls.name : 'class';
          quotaBlocked.push(subjName + ' not offered for ' + clsName + ' — subject not assigned to this class');
          continue;
        }
        const quota = (typeof getQuotaFor === 'function') ? getQuotaFor(subjectId, classId) : 0;
        const weekly = (typeof getWeeklyFor === 'function') ? getWeeklyFor(subjectId, classId) : quota;
        const currentCount = (typeof countSubjectForClass === 'function') ? countSubjectForClass(subjectId, classId) : 0;
        const subj = state.subjects.find(s=>s.id===subjectId);
        const cls = state.classes.find(c=>c.id===classId);
        const subjName = subj ? subj.name : 'Subject';
        const clsName = cls ? cls.name : 'class';

        // BLOCK if not offered
        if ((typeof getWeeklyFor === 'function' && weekly <= 0) || quota <= 0) {
          quotaBlocked.push(subjName + ' not offered for ' + clsName + ' (0 periods/week) — cannot drop/copy');
          continue;
        }

        let isSameClassMove = false;
        if (action === 'move') {
          const sameClassSameSubjCount = assignmentsToProcess.filter(a=> {
            const corr = getCorrectSubjectIdForTarget(a.subjectId, classId);
            return a.classId===classId && corr===subjectId;
          }).length;
          if (sameClassSameSubjCount === needed) {
            isSameClassMove = true;
          }
        }
        let effectiveCountAfter = currentCount + (isSameClassMove ? 0 : needed);
        if (quota > 0 && effectiveCountAfter > quota) {
          quotaBlocked.push(subjName + ' for ' + clsName + ' is already ' + currentCount + '/' + quota + ' periods (need ' + needed + ' more would be ' + effectiveCountAfter + '/' + quota + ')');
        }
      }

      if (quotaBlocked.length) {
        showToast('❌ Cannot ' + action + ': ' + quotaBlocked.join('; '));
        closeDragActionModal();
        window._draggedData = null;
        window._dropTarget = null;
        return;
      }

      // Permission: if drop will combine subjects/classes for a teacher in this period
      const combineWarnings = [];
      const excludeIds = action === 'move'
        ? assignmentsToProcess.map(a => a.id)
        : [];
      assignmentsToProcess.forEach(srcAssign => {
        let finalClassId = tgt.classId || srcAssign.classId;
        if (state.currentView === 'class' && state.selectedClassId) finalClassId = state.selectedClassId;
        if (!finalClassId && tgt.element) finalClassId = tgt.element.getAttribute('data-class-id') || srcAssign.classId;
        const correctedSubjectId = getCorrectSubjectIdForTarget(srcAssign.subjectId, finalClassId);
        if (!correctedSubjectId) return;
        const subj = state.subjects.find(s => s.id === correctedSubjectId);
        const teacher = subj ? (subj.teacher || '').trim() : '';
        const subjName = subj ? subj.name : 'Subject';
        const cls = state.classes.find(c => c.id === finalClassId);
        const clsName = cls ? cls.name : 'class';

        // Other subjects already in this cell for the same class → concurrent combine
        const sameCell = state.assignments.filter(a => {
          if (excludeIds.indexOf(a.id) >= 0) return false;
          return a.day === tgt.day && a.slotId === tgt.slotId && a.classId === finalClassId;
        });
        if (sameCell.length) {
          const others = sameCell.map(a => {
            const s = state.subjects.find(x => x.id === a.subjectId);
            return s ? s.name : '?';
          }).join(', ');
          combineWarnings.push(
            subjName + ' for ' + clsName + ' will combine in this period with: ' + others
          );
        }

        // Teacher already has other work in this day+period (other class / other subject)
        if (teacher) {
          const teacherBusy = state.assignments.filter(a => {
            if (excludeIds.indexOf(a.id) >= 0) return false;
            if (a.day !== tgt.day || a.slotId !== tgt.slotId) return false;
            const os = state.subjects.find(s => s.id === a.subjectId);
            if (!os || normalizeTeacherName(os.teacher) !== normalizeTeacherName(teacher)) return false;
            // Same class + will be concurrent group already covered above
            if (a.classId === finalClassId) return false;
            return true;
          });
          if (teacherBusy.length) {
            const details = teacherBusy.map(a => {
              const s = state.subjects.find(x => x.id === a.subjectId);
              const c = state.classes.find(x => x.id === a.classId);
              return (s ? s.name : '?') + (c ? ' · ' + c.name : '');
            }).join('; ');
            combineWarnings.push(
              teacher + ' already has this period: ' + details +
              ' — ' + action + ' will combine / share the period for this teacher'
            );
          }
        }
      });

      if (combineWarnings.length) {
        const unique = [];
        combineWarnings.forEach(w => {
          if (unique.indexOf(w) < 0) unique.push(w);
        });
        const msg =
          'This ' + action + ' will combine subjects/classes for a teacher in the same period:\n\n' +
          unique.slice(0, 6).map((w, i) => (i + 1) + '. ' + w).join('\n') +
          (unique.length > 6 ? '\n…' : '') +
          '\n\nOK = Allow combine\nCancel = Do not ' + action;
        if (!confirm(msg)) {
          showToast(action === 'move' ? 'Move cancelled' : 'Copy cancelled');
          closeDragActionModal();
          window._draggedData = null;
          window._dropTarget = null;
          return;
        }
      }

      let movedCount = 0;
      let teacherCorrections = [];

      assignmentsToProcess.forEach(srcAssign => {
        let finalClassId = tgt.classId;
        if (!finalClassId) finalClassId = srcAssign.classId;
        if (state.currentView === 'class' && state.selectedClassId) finalClassId = state.selectedClassId;
        if (!finalClassId && tgt.element) finalClassId = tgt.element.getAttribute('data-class-id') || srcAssign.classId;

        const origSubj = state.subjects.find(s=>s.id===srcAssign.subjectId);
        let correctedSubjectId = getCorrectSubjectIdForTarget(srcAssign.subjectId, finalClassId);
        if (!correctedSubjectId) {
          // Should have been blocked, skip
          return;
        }
        if (correctedSubjectId !== srcAssign.subjectId) {
          const oldTeacher = origSubj ? origSubj.teacher : '?';
          const newSubj = state.subjects.find(s=>s.id===correctedSubjectId);
          const newTeacher = newSubj ? newSubj.teacher : '?';
          teacherCorrections.push({ from: oldTeacher, to: newTeacher, subject: origSubj?origSubj.name:'' });
        }

        if (action === 'move') {
          srcAssign.day = tgt.day;
          srcAssign.slotId = tgt.slotId;
          srcAssign.classId = finalClassId;
          srcAssign.subjectId = correctedSubjectId;
          movedCount++;
        } else if (action === 'copy') {
          const newId = 'a' + Date.now() + '_' + Math.random().toString(36).slice(2,8) + '_' + movedCount;
          const clone = {
            id: newId,
            day: tgt.day,
            slotId: tgt.slotId,
            classId: finalClassId,
            subjectId: correctedSubjectId,
            grouped: srcAssign.grouped,
            groupName: srcAssign.groupName,
            autoGenerated: false
          };
          if (src.assignIds.length === 1) {
            const targetExisting = state.assignments.filter(a=>a.day===tgt.day && a.slotId===tgt.slotId && a.classId===finalClassId);
            if (targetExisting.length===0) { delete clone.grouped; delete clone.groupName; }
          }
          state.assignments.push(clone);
          movedCount++;
        }
      });

      const modal = document.getElementById('dragActionModal');
      if (modal) modal.classList.remove('open');
      window._dropTarget = null;
      window._draggedData = null;

      try { 
        localStorage.setItem('schoolMasterTimetable', JSON.stringify(state)); 
        if (typeof saveState === 'function') saveState();
      } catch(e){ console.error(e); }
      
      if (typeof renderTable === 'function') renderTable();
      if (typeof renderCompareLeft === 'function') { 
        try { renderCompareLeft(); renderCompareRight(); } catch(e){}
      }
      if (typeof updateConflicts === 'function') updateConflicts();
      if (typeof updatePeriodLoadTitle === 'function') updatePeriodLoadTitle();
      if (typeof buildGoToOptions === 'function') { try{ buildGoToOptions(); }catch(e){} }

      let msg = (action==='move' ? 'Moved ' : 'Copied ') + movedCount + ' subject(s) to ' + tgt.day;
      if (teacherCorrections.length) {
        msg += ' · auto-corrected teacher: ' + teacherCorrections.map(tc=> tc.subject + ' ' + tc.from + '→' + tc.to).join(', ');
      }
      showToast(msg);
    }

        function handleEntryTouchStart(e) {
      const el = e.currentTarget;
      if (!el) return;
      window._touchDrag = { el: el, startX: e.touches[0].clientX, startY: e.touches[0].clientY, moved: false };
      el.addEventListener('touchmove', handleEntryTouchMove, {passive:false});
      el.addEventListener('touchend', handleEntryTouchEnd, {passive:false});
    }
    function handleEntryTouchMove(e) {
      if (!window._touchDrag) return;
      const dx = e.touches[0].clientX - window._touchDrag.startX;
      const dy = e.touches[0].clientY - window._touchDrag.startY;
      if (!window._touchDrag.moved && Math.sqrt(dx*dx+dy*dy) < 10) return;
      window._touchDrag.moved = true;
      e.preventDefault();
      const el = window._touchDrag.el;
      if (!el.classList.contains('dragging')) {
        // simulate drag start
        const fakeEvent = { currentTarget: el, target: el, dataTransfer: { effectAllowed:'copyMove', setData:()=>{}, setDragImage:()=>{} } };
        handleEntryDragStart(fakeEvent);
        el.style.position = 'fixed';
        el.style.zIndex = '99999';
        el.style.pointerEvents = 'none';
        el.style.width = el.offsetWidth + 'px';
      }
      el.style.left = (e.touches[0].clientX - el.offsetWidth/2) + 'px';
      el.style.top = (e.touches[0].clientY - 20) + 'px';
      // highlight cell under finger
      const cellUnder = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY)?.closest('td.slot');
      document.querySelectorAll('td.slot.drag-over').forEach(td=>{ if (td!==cellUnder) td.classList.remove('drag-over'); });
      if (cellUnder) cellUnder.classList.add('drag-over');
      window._touchDrag.currentCell = cellUnder;
    }
    function handleEntryTouchEnd(e) {
      if (!window._touchDrag) return;
      const el = window._touchDrag.el;
      el.removeEventListener('touchmove', handleEntryTouchMove);
      el.removeEventListener('touchend', handleEntryTouchEnd);
      el.classList.remove('dragging');
      el.style.position = '';
      el.style.zIndex = '';
      el.style.pointerEvents = '';
      el.style.left = '';
      el.style.top = '';
      el.style.width = '';
      const cell = window._touchDrag.currentCell;
      document.querySelectorAll('td.slot.drag-over').forEach(td=>td.classList.remove('drag-over')); document.querySelectorAll('td.slot.drag-over-blocked').forEach(td=>td.classList.remove('drag-over-blocked'));
      document.querySelectorAll('td.slot.drag-source').forEach(td=>td.classList.remove('drag-source'));
      if (window._touchDrag.moved && cell) {
        const target = getSlotTargetInfo(cell);
        if (target && window._draggedData) {
          const sameSlot = target.day === window._draggedData.day && target.slotId === window._draggedData.slotId && (target.classId||window._draggedData.classId) === window._draggedData.classId;
          if (!sameSlot) {
            window._dropTarget = target;
            openDragActionModal();
          } else {
            window._draggedData = null;
          }
        }
      } else {
        // tap -> let click handler open modal (do nothing)
        if (!window._touchDrag.moved) {
          window._draggedData = null;
        }
      }
      window._touchDrag = null;
    }

    function initDragDropGlobal() {
      if (window._dragDropBound) return;
      window._dragDropBound = true;
      document.addEventListener('dragover', function(e){
        const cell = e.target.closest && e.target.closest('td.slot');
        if (cell && cell.closest('table.timetable')) {
          // allow
        }
      });
      // Delegate for slots
      document.addEventListener('dragover', function(e){
        const cell = e.target.closest && e.target.closest('td.slot');
        if (!cell) return;
        if (!cell.closest('table.timetable')) return;
        handleSlotDragOver.call(cell, e);
      }, false);
      document.addEventListener('dragleave', function(e){
        const cell = e.target.closest && e.target.closest('td.slot');
        if (!cell) return;
        handleSlotDragLeave.call(cell, e);
      }, false);
      document.addEventListener('drop', function(e){
        const cell = e.target.closest && e.target.closest('td.slot');
        if (!cell) return;
        if (!cell.closest('table.timetable')) return;
        handleSlotDrop.call(cell, e);
      }, false);
    }

    // Hook into existing bindMoveHintHandlers
    (function(){
      const orig = window.bindMoveHintHandlers;
      if (orig) {
        window.bindMoveHintHandlers = function(table){
          orig(table);
          initDragDropGlobal();
          // make all existing entries draggable (in case HTML patch missed some)
          if (table) {
            table.querySelectorAll('.entry').forEach(en=>{
              if (!en.hasAttribute('draggable')) {
                en.setAttribute('draggable','true');
                en.addEventListener('dragstart', handleEntryDragStart);
                en.addEventListener('dragend', handleEntryDragEnd);
              }
            });
          }
        };
      } else {
        window.bindMoveHintHandlers = function(table){ initDragDropGlobal(); };
      }
    })();


    document.addEventListener('keydown', function(e){
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase()==='s'){
        e.preventDefault();
        if (typeof saveTimetableNow === 'function') saveTimetableNow();
      }
    });

