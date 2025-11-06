let currentTab = 'orgs';
let currentOrg = null;

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  event.target.classList.add('active');
  document.getElementById(tab + '-tab').classList.add('active');
  
  if (tab === 'users' && !currentOrg) {
    document.getElementById('users-content').innerHTML = '<p class="loading">Select an organization from the Organizations tab</p>';
  } else {
    loadData();
  }
}

function selectOrg(org) {
  currentOrg = org;
  document.getElementById('orgFilter').value = org;
  switchTab('users');
}

async function loadData() {
  const days = document.getElementById('daysFilter').value;
  const orgFilter = document.getElementById('orgFilter').value;

  if (currentTab === 'orgs') {
    await loadOrgData(days);
  } else if (currentTab === 'users') {
    await loadUserData(currentOrg || orgFilter, days);
  } else if (currentTab === 'overages') {
    await loadOverageData();
  } else if (currentTab === 'events') {
    await loadEventsData(orgFilter, days);
  }
}

async function loadOrgData(days) {
  const container = document.getElementById('orgs-content');
  const statsContainer = document.getElementById('orgs-stats');
  container.innerHTML = '<p class="loading">Loading...</p>';
  statsContainer.innerHTML = '';

  try {
    const response = await fetch(`/api/org-usage?days=${days}`);
    const data = await response.json();

    if (data.error) {
      container.innerHTML = `<div class="error">Error: ${data.error}</div>`;
      return;
    }

    const totalSearches = data.reduce((sum, row) => sum + parseInt(row.event_count), 0);
    const totalOrgs = data.length;
    const totalUsers = data.reduce((sum, row) => sum + parseInt(row.unique_users), 0);

    statsContainer.innerHTML = `
      <div class="stat-card">
        <div class="label">Total Organizations</div>
        <div class="value">${totalOrgs.toLocaleString()}</div>
      </div>
      <div class="stat-card">
        <div class="label">Total Searches</div>
        <div class="value">${totalSearches.toLocaleString()}</div>
      </div>
      <div class="stat-card">
        <div class="label">Total Users</div>
        <div class="value">${totalUsers.toLocaleString()}</div>
      </div>
      <div class="stat-card">
        <div class="label">Avg Searches/Org</div>
        <div class="value">${Math.round(totalSearches / totalOrgs).toLocaleString()}</div>
      </div>
    `;

    container.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Organization</th>
            <th>Total Searches</th>
            <th>Unique Users</th>
            <th>Avg per User</th>
            <th>First Event</th>
            <th>Last Event</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(row => `
            <tr>
              <td><a class="org-link" onclick="selectOrg('${row.externalUrl}')">${row.externalUrl}</a></td>
              <td><span class="metric">${parseInt(row.event_count).toLocaleString()}</span></td>
              <td><span class="metric">${parseInt(row.unique_users).toLocaleString()}</span></td>
              <td>${Math.round(row.event_count / row.unique_users)}</td>
              <td>${new Date(row.first_event.value).toLocaleDateString()}</td>
              <td>${new Date(row.last_event.value).toLocaleDateString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (error) {
    container.innerHTML = `<div class="error">Error: ${error.message}</div>`;
  }
}

async function loadUserData(org, days) {
  const container = document.getElementById('users-content');
  
  if (!org) {
    container.innerHTML = '<p class="loading">Enter an organization URL in the filter above</p>';
    return;
  }

  container.innerHTML = '<p class="loading">Loading...</p>';

  try {
    const [usageResponse, orgUsersResponse] = await Promise.all([
      fetch(`/api/user-usage?org=${encodeURIComponent(org)}&days=${days}`),
      fetch(`/api/org-users?org=${encodeURIComponent(org)}`)
    ]);
    
    const data = await usageResponse.json();
    const orgUsers = await orgUsersResponse.json();

    if (data.error) {
      container.innerHTML = `<div class="error">Error: ${data.error}</div>`;
      return;
    }

    const hasAnyEmail = data.some(row => row.email);
    
    let orgUsersSection = '';
    if (orgUsers && orgUsers.email && orgUsers.email.length > 0) {
      orgUsersSection = `
        <div style="background: #27272a; padding: 15px; border-radius: 6px; margin-bottom: 15px;">
          <div style="color: #fff; font-weight: 500; margin-bottom: 10px;">Active Users at ${org} (${orgUsers.active_users_past30d} in last 30 days)</div>
          <div style="max-height: 200px; overflow-y: auto; font-size: 13px; color: #a1a1aa;">
            ${orgUsers.email.map(email => `<div style="padding: 3px 0;">${email}</div>`).join('')}
          </div>
        </div>
      `;
    }
    
    container.innerHTML = `
      <h3 style="margin-bottom: 15px; color: #fff;">${org}</h3>
      ${!hasAnyEmail ? '<div style="background: #27272a; padding: 12px; border-radius: 6px; margin-bottom: 15px; color: #a1a1aa; font-size: 14px;">⚠️ Email/username data is not available per-user for enterprise instances. Showing organization-level user list below.</div>' : ''}
      ${orgUsersSection}
      <div style="overflow-x: auto;">
        <table style="min-width: 1400px;">
          <thead>
            <tr>
              <th>User ID</th>
              <th>Queries</th>
              <th>Credits</th>
              <th>Completion Tokens</th>
              <th>Prompt Tokens</th>
              <th>Cached Tokens</th>
              <th>Total Tokens</th>
              <th>Tool Calls</th>
              <th>Errors</th>
              <th>Cancelled</th>
              <th>First / Last</th>
            </tr>
          </thead>
          <tbody>
            ${data.map(row => `
              <tr>
                <td>
                  ${row.username || row.userId}
                  ${row.email ? `<div style="font-size: 12px; color: #71717a;">${row.email}</div>` : ''}
                </td>
                <td><span class="metric">${parseInt(row.queries_completed || 0).toLocaleString()}</span></td>
                <td><span class="metric">${parseInt(row.total_credits || 0).toLocaleString()}</span></td>
                <td>${parseInt(row.completion_tokens || 0).toLocaleString()}</td>
                <td>${parseInt(row.prompt_tokens || 0).toLocaleString()}</td>
                <td>${parseInt(row.cached_tokens || 0).toLocaleString()}</td>
                <td>${parseInt(row.total_tokens || 0).toLocaleString()}</td>
                <td>${parseInt(row.total_tool_calls || 0).toLocaleString()}</td>
                <td>${row.error_count > 0 ? `<span class="overage">${row.error_count}</span>` : '0'}</td>
                <td>${row.cancelled_count > 0 ? row.cancelled_count : '0'}</td>
                <td style="font-size: 12px;">
                  ${new Date(row.first_search.value).toLocaleDateString()}<br>
                  ${new Date(row.last_search.value).toLocaleDateString()}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (error) {
    container.innerHTML = `<div class="error">Error: ${error.message}</div>`;
  }
}

async function loadOverageData() {
  const container = document.getElementById('overages-content');
  container.innerHTML = '<p class="loading">Loading...</p>';

  try {
    const response = await fetch('/api/overages');
    const data = await response.json();

    if (data.error) {
      container.innerHTML = `<div class="error">Error: ${data.error}</div>`;
      return;
    }

    container.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Account</th>
            <th>Month</th>
            <th>Allocation</th>
            <th>Queries</th>
            <th>Users</th>
            <th>Overage</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(row => `
            <tr>
              <td>
                <a class="org-link" onclick="selectOrg('${row.external_url}')">${row.account_name}</a>
                <div style="font-size: 12px; color: #71717a;">${row.external_url}</div>
              </td>
              <td>${row.month}</td>
              <td><span class="metric">${row.deep_search_allocation}</span></td>
              <td><span class="metric">${row.ds_queries}</span></td>
              <td><span class="metric">${row.ds_users}</span></td>
              <td><span class="overage">${row.monthly_overage.toFixed(1)}</span></td>
              <td>${row.source_type}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (error) {
    container.innerHTML = `<div class="error">Error: ${error.message}</div>`;
  }
}

async function loadEventsData(org, days) {
  const container = document.getElementById('events-content');
  container.innerHTML = '<p class="loading">Loading...</p>';

  try {
    const url = org 
      ? `/api/events-breakdown?org=${encodeURIComponent(org)}&days=${days}`
      : `/api/events-breakdown?days=${days}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      container.innerHTML = `<div class="error">Error: ${data.error}</div>`;
      return;
    }

    container.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Event Name</th>
            ${org ? '<th>Organization</th>' : ''}
            <th>Count</th>
            <th>Unique Users</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(row => `
            <tr>
              <td>${row.eventName}</td>
              ${org ? `<td>${row.externalUrl}</td>` : ''}
              <td><span class="metric">${parseInt(row.count).toLocaleString()}</span></td>
              <td><span class="metric">${parseInt(row.unique_users).toLocaleString()}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (error) {
    container.innerHTML = `<div class="error">Error: ${error.message}</div>`;
  }
}

loadData();
