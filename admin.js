// 관리자 콘솔 스크립트

let adminToken = localStorage.getItem('admin_token') || '';

document.addEventListener('DOMContentLoaded', () => {
  checkAdminAuth();
  initAdminLoginForm();
  initCreateUserForm();
  initCreateSubjectForm();
  initChangeAdminPwForm();
});

function getAdminHeaders() {
  const headers = {};
  if (adminToken) {
    headers['Authorization'] = `Bearer ${adminToken}`;
  }
  return headers;
}

async function checkAdminAuth() {
  if (!adminToken) {
    showAdminLoginModal(true);
    return;
  }
  try {
    const res = await fetch('/api/auth/me', { headers: getAdminHeaders() });
    const data = await res.json();
    if (data.authenticated && data.user.role === 'admin') {
      showAdminLoginModal(false);
      refreshAdminDashboard();
    } else {
      showAdminLoginModal(true);
    }
  } catch (err) {
    showAdminLoginModal(true);
  }
}

function showAdminLoginModal(show) {
  const modal = document.getElementById('adminLoginModal');
  if (show) modal.classList.remove('hidden');
  else modal.classList.add('hidden');
}

function initAdminLoginForm() {
  const form = document.getElementById('adminLoginForm');
  const uInput = document.getElementById('adminUsername');
  const pInput = document.getElementById('adminPassword');
  const errEl = document.getElementById('adminLoginError');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.classList.add('hidden');
    try {
      const res = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: uInput.value.trim(),
          password: pInput.value
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        adminToken = data.token;
        localStorage.setItem('admin_token', adminToken);
        showAdminLoginModal(false);
        refreshAdminDashboard();
      } else {
        errEl.textContent = data.detail || '관리자 로그인 정보가 올바르지 않습니다.';
        errEl.classList.remove('hidden');
      }
    } catch (err) {
      errEl.textContent = '서버 통신 오류가 발생했습니다.';
      errEl.classList.remove('hidden');
    }
  });
}

function adminLogout() {
  if (confirm('관리자 세션을 로그아웃 하시겠습니까?')) {
    localStorage.removeItem('admin_token');
    adminToken = '';
    window.location.reload();
  }
}

function switchAdminTab(tabName) {
  ['users', 'subjects', 'security'].forEach(t => {
    document.getElementById(`atab-${t}`).className = 'pb-3 text-sm font-semibold border-b-2 border-transparent text-slate-400 hover:text-slate-200 flex items-center gap-2';
    document.getElementById(`apanel-${t}`).classList.add('hidden');
  });

  const activeBtn = document.getElementById(`atab-${tabName}`);
  const activePanel = document.getElementById(`apanel-${tabName}`);
  activeBtn.className = 'pb-3 text-sm font-semibold border-b-2 border-indigo-500 text-indigo-400 flex items-center gap-2';
  activePanel.classList.remove('hidden');
}

async function refreshAdminDashboard() {
  loadStats();
  loadUsers();
  loadSubjects();
}

async function loadStats() {
  try {
    const res = await fetch('/api/admin/stats', { headers: getAdminHeaders() });
    if (!res.ok) return;
    const stats = await res.json();

    document.getElementById('statPendingUsers').textContent = stats.pending_users;
    document.getElementById('statApprovedUsers').textContent = stats.approved_users;
    document.getElementById('statTotalSubjects').textContent = stats.total_subjects;
    document.getElementById('statTotalDocs').textContent = (stats.total_lectures + stats.total_exams);

    const badge = document.getElementById('badgePendingCount');
    if (stats.pending_users > 0) {
      badge.textContent = stats.pending_users;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  } catch (err) {
    console.error(err);
  }
}

async function loadUsers() {
  try {
    const res = await fetch('/api/admin/users', { headers: getAdminHeaders() });
    if (!res.ok) return;
    const users = await res.json();

    // 1. 승인 대기자 목록
    const pending = users.filter(u => u.status === 'pending');
    document.getElementById('pendingListCountText').textContent = `${pending.length}건 대기 중`;

    const pendingBody = document.getElementById('pendingUsersBody');
    if (pending.length === 0) {
      pendingBody.innerHTML = `<tr><td colspan="5" class="px-6 py-6 text-center text-slate-500 text-xs">현재 대기 중인 가입 신청이 없습니다.</td></tr>`;
    } else {
      pendingBody.innerHTML = pending.map(u => `
        <tr class="hover:bg-slate-800/50">
          <td class="px-6 py-3.5 font-bold text-white">${escapeHtml(u.name)}</td>
          <td class="px-6 py-3.5 font-mono text-xs text-indigo-300">${escapeHtml(u.username)}</td>
          <td class="px-6 py-3.5 text-xs text-slate-300">${escapeHtml(u.note || '-')}</td>
          <td class="px-6 py-3.5 text-xs text-slate-400">${u.created_at || '-'}</td>
          <td class="px-6 py-3.5 text-right space-x-2">
            <button onclick="setUserStatus('${u.id}', 'approved')" class="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow transition">
              <i class="fa-solid fa-check text-[10px]"></i> 승인
            </button>
            <button onclick="setUserStatus('${u.id}', 'rejected')" class="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg shadow transition">
              <i class="fa-solid fa-xmark text-[10px]"></i> 거절
            </button>
          </td>
        </tr>
      `).join('');
    }

    // 2. 전체 이용자 목록
    const allBody = document.getElementById('allUsersBody');
    allBody.innerHTML = users.map(u => {
      let statusBadge = '<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">승인 대기</span>';
      if (u.status === 'approved') {
        statusBadge = '<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">이용 승인됨</span>';
      } else if (u.status === 'rejected') {
        statusBadge = '<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">이용 거절/정지</span>';
      }

      return `
        <tr class="hover:bg-slate-800/50">
          <td class="px-6 py-3.5 font-semibold text-white">${escapeHtml(u.name)}</td>
          <td class="px-6 py-3.5 font-mono text-xs text-slate-300">${escapeHtml(u.username)}</td>
          <td class="px-6 py-3.5">${statusBadge}</td>
          <td class="px-6 py-3.5 text-xs text-slate-400">${escapeHtml(u.note || '-')}</td>
          <td class="px-6 py-3.5 text-xs text-slate-400">${u.created_at || '-'}</td>
          <td class="px-6 py-3.5 text-right space-x-1.5">
            ${u.status === 'approved' ? `
              <button onclick="setUserStatus('${u.id}', 'rejected')" class="px-2.5 py-1 text-xs text-amber-400 hover:bg-amber-400/10 rounded border border-amber-400/30">
                권한 정지
              </button>
            ` : `
              <button onclick="setUserStatus('${u.id}', 'approved')" class="px-2.5 py-1 text-xs text-emerald-400 hover:bg-emerald-400/10 rounded border border-emerald-400/30">
                이용 승인
              </button>
            `}
            <button onclick="resetUserPassword('${u.id}', '${escapeHtml(u.name)}')" class="px-2.5 py-1 text-xs text-indigo-400 hover:bg-indigo-400/10 rounded border border-indigo-400/30">
              비번 재설정
            </button>
            <button onclick="deleteUser('${u.id}')" class="px-2.5 py-1 text-xs text-rose-400 hover:bg-rose-400/10 rounded border border-rose-400/30">
              삭제
            </button>
          </td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error(err);
  }
}

async function setUserStatus(userId, status) {
  try {
    const res = await fetch(`/api/admin/users/${userId}/status`, {
      method: 'POST',
      headers: { ...getAdminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (res.ok) {
      refreshAdminDashboard();
    } else {
      alert('상태 변경 실패');
    }
  } catch (err) {
    alert('통신 오류');
  }
}

async function deleteUser(userId) {
  if (!confirm('이 이용자 계정을 영구 삭제하시겠습니까?')) return;
  try {
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'DELETE',
      headers: getAdminHeaders()
    });
    if (res.ok) {
      refreshAdminDashboard();
    }
  } catch (err) {
    alert('삭제 오류');
  }
}

async function resetUserPassword(userId, userName) {
  const newPw = prompt(`[${userName}] 이용자의 새로운 비밀번호를 입력하세요:`);
  if (!newPw) return;
  if (newPw.trim().length < 4) {
    alert('비밀번호는 최소 4자 이상이어야 합니다.');
    return;
  }
  try {
    const res = await fetch(`/api/admin/users/${userId}/reset-password`, {
      method: 'POST',
      headers: { ...getAdminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_password: newPw.trim() })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      alert(data.message || '비밀번호가 재설정되었습니다.');
    } else {
      alert('비밀번호 재설정 실패: ' + (data.detail || ''));
    }
  } catch (err) {
    alert('통신 오류');
  }
}

function openCreateUserModal() {
  document.getElementById('createUserModal').classList.remove('hidden');
}
function closeCreateUserModal() {
  document.getElementById('createUserModal').classList.add('hidden');
}

function initCreateUserForm() {
  const form = document.getElementById('createUserForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('newUserName').value.trim();
    const username = document.getElementById('newUserUsername').value.trim();
    const password = document.getElementById('newUserPassword').value.trim();
    const note = document.getElementById('newUserNote').value.trim();

    try {
      const res = await fetch('/api/admin/users/create', {
        method: 'POST',
        headers: { ...getAdminHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, username, password, note })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert('새 이용자 계정이 생성 및 승인되었습니다.');
        form.reset();
        closeCreateUserModal();
        refreshAdminDashboard();
      } else {
        alert('생성 실패: ' + (data.detail || ''));
      }
    } catch (err) {
      alert('서버 에러');
    }
  });
}

// ----------------- 과목 관리 -----------------

async function loadSubjects() {
  try {
    const res = await fetch('/api/subjects', { headers: getAdminHeaders() });
    if (!res.ok) return;
    const subs = await res.json();

    const tbody = document.getElementById('subjectsBody');
    if (subs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-6 text-center text-slate-500 text-xs">개설된 과목이 없습니다. 새 과목을 추가해주세요.</td></tr>`;
      return;
    }

    tbody.innerHTML = subs.map(s => `
      <tr class="hover:bg-slate-800/50">
        <td class="px-6 py-3.5 font-bold text-white flex items-center gap-2">
          <i class="fa-solid fa-book-open text-indigo-400"></i>
          <span>${escapeHtml(s.name)}</span>
        </td>
        <td class="px-6 py-3.5 text-xs text-slate-400">${escapeHtml(s.description || '-')}</td>
        <td class="px-6 py-3.5 text-xs font-semibold text-cyan-300">${s.lecture_count || 0}개 문서</td>
        <td class="px-6 py-3.5 text-xs font-semibold text-indigo-300">${s.exam_count || 0}개 세트</td>
        <td class="px-6 py-3.5 text-right">
          <button onclick="deleteSubject('${s.id}')" class="px-2.5 py-1 text-xs text-rose-400 hover:bg-rose-400/10 rounded border border-rose-400/30">
            삭제
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}

function openCreateSubjectModal() {
  document.getElementById('createSubjectModal').classList.remove('hidden');
}
function closeCreateSubjectModal() {
  document.getElementById('createSubjectModal').classList.add('hidden');
}

function initCreateSubjectForm() {
  const form = document.getElementById('createSubjectForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('newSubName').value.trim();
    const desc = document.getElementById('newSubDesc').value.trim();

    try {
      const res = await fetch('/api/admin/subjects', {
        method: 'POST',
        headers: { ...getAdminHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: desc })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert('과목이 새로 개설되었습니다.');
        form.reset();
        closeCreateSubjectModal();
        refreshAdminDashboard();
      } else {
        alert('과목 추가 실패');
      }
    } catch (err) {
      alert('서버 에러');
    }
  });
}

async function deleteSubject(subId) {
  if (!confirm('이 과목을 삭제하시겠습니까? (과목에 연결된 자료들이 보이지 않게 됩니다)')) return;
  try {
    const res = await fetch(`/api/admin/subjects/${subId}`, {
      method: 'DELETE',
      headers: getAdminHeaders()
    });
    if (res.ok) {
      refreshAdminDashboard();
    }
  } catch (err) {
    alert('삭제 에러');
  }
}

// ----------------- 관리자 비밀번호 변경 -----------------

function initChangeAdminPwForm() {
  const form = document.getElementById('changeAdminPwForm');
  const msg = document.getElementById('adminPwMsg');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.classList.add('hidden');
    const oldP = document.getElementById('currentAdminPw').value;
    const newP = document.getElementById('newAdminPw').value;

    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: { ...getAdminHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ old_password: oldP, new_password: newP })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        msg.textContent = '관리자 비밀번호가 성공적으로 변경되었습니다!';
        msg.className = 'text-xs text-emerald-400 font-semibold block';
        form.reset();
      } else {
        msg.textContent = data.detail || '비밀번호 변경 실패';
        msg.className = 'text-xs text-rose-400 font-semibold block';
      }
    } catch (err) {
      msg.textContent = '서버 통신 오류';
      msg.className = 'text-xs text-rose-400 font-semibold block';
    }
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
