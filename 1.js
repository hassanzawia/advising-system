/* ============================================================================
   وحدة اللوائح الأكاديمية — منظومة الإرشاد الأكاديمي
   قسم الهندسة الكهربائية والإلكترونية | كلية الهندسة | جامعة طرابلس

   تطبّق:
     1) مقياس تحويل الدرجات إلى نقاط (سقف 4.00) — 11 تقديراً
     2) حساب المعدل: مجموع (الوحدات × النقاط) ÷ مجموع الوحدات
     3) ضوابط العبء الدراسي: 12 حداً أدنى، 18 عادي، 21 للمتفوقين

   الاستخدام: ضع الملف بجانب index.html، وأضف قبل </body> مباشرة:
       <script src="academic-rules.js"></script>

   ملاحظة: هذا الملف يعمل بأسلوب "الطبقة العلوية" فلا يعدّل منطق
   المنظومة الأصلي، بل يستبدل الدوال المعنية بعد تحميلها.
   ============================================================================ */
(function () {
  'use strict';

  /* -------------------------------------------------------------------------
     1) الثوابت — عدّلها هنا فقط إن تغيّرت لائحة الكلية
     ------------------------------------------------------------------------- */
  const RULES = {
    MIN_LOAD: 12,             // الحد الأدنى للتسجيل في الفصل العادي
    NORMAL_MAX_LOAD: 18,      // الحد الأعلى العادي
    EXCELLENCE_MAX_LOAD: 21,  // الحد الأعلى للمتفوقين
    EXCELLENCE_GPA: 3.00,     // مكافئ 75% على مقياس 4.00 (تقدير «ب»)
    AT_RISK_GPA: 2.00,        // حد التعثر
    GRADUATION_CREDITS: 154   // إجمالي وحدات التخرج
  };

  /* -------------------------------------------------------------------------
     2) مقياس تحويل الدرجة المئوية إلى نقاط
     ------------------------------------------------------------------------- */
  const GRADE_SCALE = [
    { min: 90, max: 100, points: 4.00, letter: 'أ'  },
    { min: 85, max: 89,  points: 3.75, letter: 'أ-' },
    { min: 80, max: 84,  points: 3.50, letter: 'ب+' },
    { min: 75, max: 79,  points: 3.00, letter: 'ب'  },
    { min: 70, max: 74,  points: 2.50, letter: 'ب-' },
    { min: 65, max: 69,  points: 2.25, letter: 'ج+' },
    { min: 60, max: 64,  points: 2.00, letter: 'ج'  },
    { min: 55, max: 59,  points: 1.75, letter: 'ج-' },
    { min: 50, max: 54,  points: 1.50, letter: 'د+' },
    { min: 45, max: 49,  points: 1.00, letter: 'د'  },
    { min: 0,  max: 44,  points: 0.00, letter: 'هـ' }
  ];

  function gradeToPoints(grade) {
    const g = Number(grade);
    if (isNaN(g) || g < 0 || g > 100) return 0;
    const b = GRADE_SCALE.find(x => g >= x.min && g <= x.max);
    return b ? b.points : 0;
  }

  function gradeToLetter(grade) {
    const g = Number(grade);
    if (isNaN(g) || g < 0 || g > 100) return '—';
    const b = GRADE_SCALE.find(x => g >= x.min && g <= x.max);
    return b ? b.letter : '—';
  }

  /* -------------------------------------------------------------------------
     3) ضوابط العبء الدراسي
     ------------------------------------------------------------------------- */
  function isExcellent(gpa) { return Number(gpa) >= RULES.EXCELLENCE_GPA; }
  function isAtRisk(gpa)    { return Number(gpa) <  RULES.AT_RISK_GPA; }

  function getMaxLoad(gpa) {
    return isExcellent(gpa) ? RULES.EXCELLENCE_MAX_LOAD : RULES.NORMAL_MAX_LOAD;
  }
  function getMinLoad() { return RULES.MIN_LOAD; }

  /* -------------------------------------------------------------------------
     4) حساب معدل طالب من سجلّه المحفوظ
     ------------------------------------------------------------------------- */
  function computeStudentGPA(student) {
    let credits = 0, points = 0;

    // مقررات الخطة
    const grades = student.passedGrades || {};
    (student.passedPrereqs || []).forEach(code => {
      const c = (window.courses || []).find(x => x.code === code);
      if (!c) return;
      const g = grades[code];
      if (g === undefined || g === null || g === '') return;
      credits += c.credits;
      points  += c.credits * gradeToPoints(g);
    });

    // المقررات المحوّلة/الإضافية
    (student.customPassedCourses || []).forEach(cc => {
      const cr = Number(cc.credits) || 0;
      if (!cr) return;
      credits += cr;
      points  += cr * gradeToPoints(cc.grade);
    });

    return {
      gpa: credits > 0 ? Math.round((points / credits) * 100) / 100 : 0,
      totalCredits: credits,
      totalPoints: Math.round(points * 100) / 100
    };
  }

  /* -------------------------------------------------------------------------
     5) إعادة احتساب كل الطلاب بالمقياس الجديد
     ------------------------------------------------------------------------- */
  function recalcAllStudents(silent) {
    if (!Array.isArray(window.students) || !window.students.length) {
      if (!silent) alert('لا توجد بيانات طلاب لإعادة احتسابها.');
      return [];
    }
    const report = [];
    window.students.forEach(s => {
      const before = Number(s.gpa) || 0;
      const r = computeStudentGPA(s);

      // لا نغيّر شيئاً إن لم تكن هناك درجات مسجّلة أصلاً
      if (r.totalCredits === 0) {
        report.push({ id: s.id, name: s.name, before, after: before, changed: false, note: 'لا توجد درجات مسجّلة' });
        return;
      }

      s.gpa = r.gpa;
      s.passedHours = Math.min(r.totalCredits, RULES.GRADUATION_CREDITS);
      if (typeof window.calculateAutomaticLevel === 'function') {
        s.level = window.calculateAutomaticLevel(s.passedHours);
      }
      s.status = isAtRisk(s.gpa) ? 'متعثر' : 'منتظم';

      report.push({
        id: s.id, name: s.name, before, after: s.gpa,
        changed: Math.abs(before - s.gpa) > 0.001,
        credits: r.totalCredits,
        maxLoad: getMaxLoad(s.gpa)
      });
    });

    if (typeof window.saveStudentsLocally === 'function') window.saveStudentsLocally();
    if (typeof window.renderStudentsList === 'function') window.renderStudentsList();
    if (window.currentStudentId && typeof window.selectStudent === 'function') {
      window.selectStudent(window.currentStudentId);
    }
    if (!silent) showRecalcReport(report);
    return report;
  }

  function showRecalcReport(report) {
    const changed = report.filter(r => r.changed);
    let msg = `✅ أُعيد احتساب ${report.length} طالب وفق المقياس الجديد.\n\n`;
    if (!changed.length) {
      msg += 'لم تتغيّر أي معدلات.';
    } else {
      msg += `تغيّر معدل ${changed.length} طالب:\n\n`;
      changed.slice(0, 15).forEach(r => {
        const dir = r.after > r.before ? '↑' : '↓';
        msg += `• ${r.name} (${r.id}): ${r.before.toFixed(2)} ← ${r.after.toFixed(2)} ${dir}  |  حد التسجيل: ${r.maxLoad} وحدة\n`;
      });
      if (changed.length > 15) msg += `\n... و${changed.length - 15} طالباً آخر.`;
    }
    alert(msg);
  }

  /* -------------------------------------------------------------------------
     6) استبدال دوال المنظومة بعد تحميلها
     ------------------------------------------------------------------------- */
  function applyOverrides() {

    /* (أ) مقياس النقاط */
    window.getEngineeringGpaPoints = gradeToPoints;

    /* (ب) لوحة التسجيل: الحدود الجديدة */
    window.updateDashboard = function (student) {
      const tbody = document.getElementById('registeredTableBody');
      tbody.innerHTML = '';
      let totalCredits = 0;
      if (!student.registered) student.registered = [];

      student.registered.forEach((cCode, index) => {
        const c = window.courses.find(item => item.code === cCode);
        if (!c) return;
        totalCredits += c.credits;
        const weeklyHrs = window.calculateWeeklyHours(c.credits, c.isLab);
        const tr = document.createElement('tr');
        tr.innerHTML =
          `<td style="text-align:center;">${index + 1}</td>` +
          `<td><strong>${c.code}</strong></td><td>${c.name}</td>` +
          `<td style="text-align:center;"><strong>${c.credits}</strong></td>` +
          `<td style="text-align:center;"><span class="badge badge-info">${weeklyHrs} ساعات</span></td>` +
          `<td style="text-align:center;">${c.passingGrade || 50}</td>` +
          `<td>${c.prereq}</td>` +
          `<td><span class="badge badge-info">${c.track}</span></td>` +
          `<td style="text-align:center;"><button type="button" onclick="removeCourse('${c.code}')" class="btn btn-danger" style="padding:2px 6px; font-size:10px;">إلغاء</button></td>`;
        tbody.appendChild(tr);
      });

      if (student.registered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:#94a3b8;">لا توجد مقررات مسجلة</td></tr>`;
      }

      document.getElementById('registeredCreditsCount').textContent = totalCredits;

      // التقدم نحو التخرج
      const overall = (student.passedHours || 0) + totalCredits;
      const gradPct = Math.min((overall / RULES.GRADUATION_CREDITS) * 100, 100);
      document.getElementById('gradProgressBar').style.width = `${gradPct}%`;
      document.getElementById('gradPercentText').textContent = `${Math.round(gradPct)}%`;
      document.getElementById('totalProgressUnits').textContent = overall;
      document.getElementById('remainingGradUnits').textContent =
        Math.max(RULES.GRADUATION_CREDITS - overall, 0);

      // ===== ضوابط العبء وفق اللائحة =====
      const gpa = Number(student.gpa) || 0;
      const excellent = isExcellent(gpa);
      const maxLimit = getMaxLoad(gpa);
      const minLimit = getMinLoad();

      const alertBox = document.getElementById('creditStatusAlert');
      const bar = document.getElementById('creditBar');
      const pct = Math.min((totalCredits / maxLimit) * 100, 100);
      bar.style.width = `${pct}%`;
      document.getElementById('percentageText').textContent =
        `${Math.round((totalCredits / maxLimit) * 100)}% (الحد الأقصى: ${maxLimit} وحدة)`;
      const rangeEl = document.getElementById('policyCreditsRange');
      if (rangeEl) rangeEl.textContent = `${minLimit} - ${maxLimit}`;

      if (totalCredits > RULES.EXCELLENCE_MAX_LOAD) {
        bar.style.background = '#ef4444';
        alertBox.style.color = '#b91c1c';
        alertBox.innerHTML = `⛔ ${totalCredits} وحدة تتجاوز الحد الأقصى المطلق (${RULES.EXCELLENCE_MAX_LOAD} وحدة) لأي طالب.`;
      } else if (totalCredits > maxLimit) {
        bar.style.background = '#ef4444';
        alertBox.style.color = '#b91c1c';
        alertBox.innerHTML = `⛔ ${totalCredits} وحدة تتجاوز الحد العادي (${RULES.NORMAL_MAX_LOAD} وحدة). ` +
          `التسجيل حتى ${RULES.EXCELLENCE_MAX_LOAD} وحدة للمتفوقين فقط (معدل ≥ ${RULES.EXCELLENCE_GPA.toFixed(2)} أي 75%). المعدل الحالي: ${gpa.toFixed(2)}`;
      } else if (totalCredits === 0) {
        bar.style.background = '#cbd5e1';
        alertBox.style.color = '#64748b';
        alertBox.textContent = 'لم يتم تنزيل مقررات بعد.';
      } else if (totalCredits < minLimit) {
        if (student.hasDeptApproval) {
          bar.style.background = '#9333ea';
          alertBox.style.color = '#6b21a8';
          alertBox.innerHTML = `ℹ️ ${totalCredits} وحدة أقل من الحد الأدنى (${minLimit}) — بموجب استثناء رئيس القسم.`;
        } else {
          bar.style.background = '#f59e0b';
          alertBox.style.color = '#b45309';
          alertBox.innerHTML = `⚠️ ${totalCredits} وحدة أقل من الحد الأدنى للتسجيل (${minLimit} وحدة).`;
        }
      } else if (excellent && totalCredits > RULES.NORMAL_MAX_LOAD) {
        bar.style.background = '#3b82f6';
        alertBox.style.color = '#1d4ed8';
        alertBox.innerHTML = `✅ ${totalCredits} وحدة — ضمن حد المتفوقين (${RULES.EXCELLENCE_MAX_LOAD} وحدة). المعدل: ${gpa.toFixed(2)}`;
      } else {
        bar.style.background = '#10b981';
        alertBox.style.color = '#15803d';
        alertBox.innerHTML = `✔ ${totalCredits} وحدة — ضمن العبء النظامي (${minLimit}–${RULES.NORMAL_MAX_LOAD} وحدة).`;
      }
    };

    /* (ج) منع تنزيل مقرر يخالف اللائحة */
    window.addSelectedCourse = function () {
      if (!window.currentStudentId) return;
      const code = document.getElementById('courseSelectDropdown').value;
      if (!code) return alert('اختر مقرراً');

      const student = window.students.find(s => s.id === window.currentStudentId);
      if (!student) return;
      if ((student.registered || []).includes(code)) return alert('المقرر مسجل مسبقاً');

      const course = window.courses.find(c => c.code === code);
      if (!course) return;

      const gpa = Number(student.gpa) || 0;
      const maxLimit = getMaxLoad(gpa);
      const current = (student.registered || []).reduce((sum, cc) => {
        const c = window.courses.find(x => x.code === cc);
        return sum + (c ? c.credits : 0);
      }, 0);
      const after = current + course.credits;

      if (!student.hasDeptApproval) {
        if (after > RULES.EXCELLENCE_MAX_LOAD) {
          return window.showError(`⛔ حظر التنزيل: الإجمالي سيبلغ ${after} وحدة ويتجاوز الحد الأقصى المطلق (${RULES.EXCELLENCE_MAX_LOAD} وحدة) لأي طالب.`);
        }
        if (after > maxLimit) {
          return window.showError(
            `⛔ حظر التنزيل: الإجمالي سيبلغ ${after} وحدة ويتجاوز الحد العادي (${RULES.NORMAL_MAX_LOAD} وحدة). ` +
            `التسجيل حتى ${RULES.EXCELLENCE_MAX_LOAD} وحدة متاح للمتفوقين فقط (معدل ≥ ${RULES.EXCELLENCE_GPA.toFixed(2)} أي 75%). معدل الطالب: ${gpa.toFixed(2)}`);
        }
      }

      // المتطلبات السابقة
      if (course.prereq && course.prereq !== 'لا يوجد' && !student.hasDeptApproval) {
        const reqs = (course.prereq.match(/[A-Z]{2,3}\d{3}[A-Z]?/g) || []);
        const missing = reqs.filter(r => !(student.passedPrereqs || []).includes(r));
        if (missing.length > 0) {
          return window.showError(`⛔ حظر التنزيل: لم يتم اجتياز المتطلب السابق: (${missing.join(', ')}).`);
        }
      }

      // مشروع التخرج
      if (code === 'EE599') {
        const p = student.passedPrereqs || [];
        if ((student.passedHours || 0) < 125 || !p.includes('EE416') || !p.includes('GH152')) {
          return window.showError('⛔ شرط مشروع التخرج غير متوفر (125 وحدة سابقة + EE416 + GH152).');
        }
      }

      window.hideError();
      student.registered.push(code);
      window.saveStudentsLocally();
      window.updateDashboard(student);
      window.renderStudentsList();
    };

    /* (د) تصحيح شارة الحالة أعلى بطاقة الطالب */
    const _selectStudent = window.selectStudent;
    window.selectStudent = function (id) {
      _selectStudent(id);
      const s = window.students.find(x => x.id === id);
      if (!s) return;
      const gpa = Number(s.gpa) || 0;
      const badge = document.getElementById('statusBadge');
      const range = document.getElementById('policyCreditsRange');
      if (isAtRisk(gpa)) {
        badge.textContent = `متعثر (${RULES.MIN_LOAD} - ${RULES.NORMAL_MAX_LOAD} وحدة)`;
        badge.className = 'badge badge-warning';
      } else if (isExcellent(gpa)) {
        badge.textContent = `متفوق (${RULES.MIN_LOAD} - ${RULES.EXCELLENCE_MAX_LOAD} وحدة)`;
        badge.className = 'badge badge-info';
      } else {
        badge.textContent = `منتظم (${RULES.MIN_LOAD} - ${RULES.NORMAL_MAX_LOAD} وحدة)`;
        badge.className = 'badge badge-success';
      }
      if (range) range.textContent = `${RULES.MIN_LOAD} - ${getMaxLoad(gpa)}`;
    };

    /* (هـ) زر إعادة الاحتساب في شريط الأدوات */
    injectRecalcButton();

    /* (و) تحديث نص السياسة المعروض */
    const strip = document.querySelector('.policy-strip .policy-text div');
    if (strip) {
      strip.innerHTML =
        '<strong>ضوابط العبء الدراسي:</strong> الحد الأدنى 12 وحدة، الحد الأعلى العادي 18 وحدة، ' +
        'وحتى 21 وحدة للمتفوقين (معدل ≥ 3.00 أي ما يعادل 75%).';
    }
  }

  function injectRecalcButton() {
    const bar = document.querySelector('.action-bar > div:last-child');
    if (!bar || document.getElementById('recalcAllBtn')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'recalcAllBtn';
    btn.className = 'btn btn-secondary';
    btn.textContent = '🔄 إعادة احتساب المعدلات';
    btn.title = 'إعادة احتساب معدلات جميع الطلاب وفق مقياس اللائحة (سقف 4.00)';
    btn.onclick = function () {
      if (confirm('سيُعاد احتساب معدلات جميع الطلاب وفق مقياس اللائحة (11 تقديراً، سقف 4.00).\n\nقد تتغيّر بعض المعدلات المحفوظة. المتابعة؟')) {
        recalcAllStudents(false);
      }
    };
    bar.appendChild(btn);
  }

  /* -------------------------------------------------------------------------
     7) الإقلاع — بعد تحميل المنظومة بالكامل
     ------------------------------------------------------------------------- */
  let bootTries = 0;
  function boot() {
    if (typeof window.updateDashboard !== 'function') {
      // سقف للمحاولات (~6 ثوانٍ) لتفادي حلقة انتظار لا تنتهي
      if (++bootTries > 50) {
        console.error('[اللوائح الأكاديمية] تعذر العثور على دوال المنظومة. ' +
          'تأكد من وضع <script src="academic-rules.js"></script> قبل </body> مباشرة.');
        return;
      }
      setTimeout(boot, 120);
      return;
    }
    applyOverrides();
    if (window.currentStudentId && typeof window.selectStudent === 'function') {
      window.selectStudent(window.currentStudentId);
    }
    console.log('[اللوائح الأكاديمية] تم التطبيق: مقياس 4.00 + ضوابط 12/18/21 وحدة.');
  }

  if (document.readyState === 'complete') setTimeout(boot, 300);
  else window.addEventListener('load', () => setTimeout(boot, 300));

  // إتاحة الأدوات للاستخدام اليدوي من الـ Console
  window.ACADEMIC_RULES        = RULES;
  window.GRADE_SCALE           = GRADE_SCALE;
  window.gradeToPoints         = gradeToPoints;
  window.gradeToLetter         = gradeToLetter;
  window.isExcellentStudent    = isExcellent;
  window.getMaxLoad            = getMaxLoad;
  window.computeStudentGPA     = computeStudentGPA;
  window.recalcAllStudents     = recalcAllStudents;
})();
