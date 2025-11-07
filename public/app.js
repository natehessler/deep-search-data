let currentTab = 'orgs';
let currentOrg = null;
let sortColumn = null;
let sortDirection = 'desc';
let orgList = [];

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  event.target.classList.add('active');
  document.getElementById(tab + '-tab').classList.add('active');
  
  const filterLabel = document.getElementById('filterLabel');
  const orgFilter = document.getElementById('orgFilter');
  
  if (tab === 'orgs') {
    currentOrg = null;
    orgFilter.value = '';
    filterLabel.textContent = 'Organization: ';
    orgFilter.placeholder = 'Filter by org...';
  } else if (tab === 'users') {
    filterLabel.textContent = 'User/Org: ';
    orgFilter.placeholder = 'Filter by user ID or org...';
  } else if (tab === 'overages') {
    filterLabel.textContent = 'Account: ';
    orgFilter.placeholder = 'Filter by account name...';
  } else if (tab === 'events') {
    filterLabel.textContent = 'Organization: ';
    orgFilter.placeholder = 'Filter by org...';
  }
  
  loadData();
}

function selectOrg(org) {
  currentOrg = org;
  document.getElementById('orgFilter').value = org;
  switchTab('users');
}

function clearFilters() {
  currentOrg = null;
  document.getElementById('orgFilter').value = '';
  loadData();
}

function sortData(data, column, type = 'number') {
  if (!column) return data;
  
  return [...data].sort((a, b) => {
    let aVal = a[column];
    let bVal = b[column];
    
    if (type === 'number') {
      aVal = parseFloat(aVal) || 0;
      bVal = parseFloat(bVal) || 0;
    } else if (type === 'date') {
      aVal = new Date(aVal?.value || aVal).getTime();
      bVal = new Date(bVal?.value || bVal).getTime();
    } else {
      aVal = String(aVal || '').toLowerCase();
      bVal = String(bVal || '').toLowerCase();
    }
    
    if (sortDirection === 'asc') {
      return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    } else {
      return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
    }
  });
}

function toggleSort(column, type = 'number') {
  if (sortColumn === column) {
    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    sortColumn = column;
    sortDirection = 'desc';
  }
  loadData();
}

function getSortIcon(column) {
  if (sortColumn !== column) return '';
  return sortDirection === 'asc' ? ' ↑' : ' ↓';
}

function updateOrgDatalist() {
  const datalist = document.getElementById('orgList');
  datalist.innerHTML = orgList.map(org => `<option value="${org}">`).join('');
}

async function loadData() {
  const days = document.getElementById('daysFilter').value;
  const orgFilter = document.getElementById('orgFilter').value;

  if (currentTab === 'orgs') {
    await loadOrgData(days);
  } else if (currentTab === 'users') {
    await loadUserData(currentOrg || orgFilter, days);
  } else if (currentTab === 'overages') {
    await loadOverageData(orgFilter);
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

    // Store org list for autocomplete
    orgList = data.map(row => row.externalUrl).sort();
    updateOrgDatalist();

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

    const sortedData = sortData(data, sortColumn, sortColumn === 'externalUrl' ? 'string' : sortColumn === 'first_event' || sortColumn === 'last_event' ? 'date' : 'number');

    container.innerHTML = `
      <table>
        <thead>
          <tr>
            <th onclick="toggleSort('externalUrl', 'string')" style="cursor: pointer;">Organization${getSortIcon('externalUrl')}</th>
            <th onclick="toggleSort('event_count', 'number')" style="cursor: pointer;">Total Searches${getSortIcon('event_count')}</th>
            <th onclick="toggleSort('unique_users', 'number')" style="cursor: pointer;">Unique Users${getSortIcon('unique_users')}</th>
            <th>Avg per User</th>
            <th onclick="toggleSort('first_event', 'date')" style="cursor: pointer;">First Event${getSortIcon('first_event')}</th>
            <th onclick="toggleSort('last_event', 'date')" style="cursor: pointer;">Last Event${getSortIcon('last_event')}</th>
          </tr>
        </thead>
        <tbody>
          ${sortedData.map(row => `
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

async function loadUserData(filter, days) {
  const container = document.getElementById('users-content');
  
  if (!filter) {
    container.innerHTML = '<p class="loading">Enter a user ID or organization URL in the filter above</p>';
    return;
  }

  container.innerHTML = '<p class="loading">Loading...</p>';

  try {
    const [usageResponse, orgUsersResponse] = await Promise.all([
      fetch(`/api/user-usage?org=${encodeURIComponent(filter)}&days=${days}`),
      fetch(`/api/org-users?org=${encodeURIComponent(filter)}`)
    ]);
    
    const data = await usageResponse.json();
    const orgUsers = await orgUsersResponse.json();

    if (data.error) {
      container.innerHTML = `<div class="error">Error: ${data.error}</div>`;
      return;
    }

    const filteredData = data.filter(row => {
      const searchTerm = filter.toLowerCase();
      return (
        String(row.userId).toLowerCase().includes(searchTerm) ||
        row.username?.toLowerCase().includes(searchTerm) ||
        row.email?.toLowerCase().includes(searchTerm) ||
        row.externalUrl?.toLowerCase().includes(searchTerm)
      );
    });

    let orgUsersSection = '';
    if (orgUsers && orgUsers.email && orgUsers.email.length > 0) {
      orgUsersSection = `
        <div style="background: #27272a; padding: 15px; border-radius: 6px; margin-bottom: 15px;">
          <div style="color: #fff; font-weight: 500; margin-bottom: 10px;">Invited/Licensed Users at ${orgUsers.externalUrl}</div>
          <div style="color: #a1a1aa; font-size: 12px; margin-bottom: 8px;">${orgUsers.email.length} total invited users (from org data, not filtered by Deep Search activity)</div>
          <div style="max-height: 200px; overflow-y: auto; font-size: 13px; color: #a1a1aa;">
            ${orgUsers.email.map(email => `<div style="padding: 3px 0;">${email}</div>`).join('')}
          </div>
        </div>
      `;
    }

    const hasAnyEmail = filteredData.some(row => row.email);
    const sortedData = sortData(filteredData, sortColumn, sortColumn === 'username' ? 'string' : sortColumn === 'first_search' || sortColumn === 'last_search' ? 'date' : 'number');
    
    container.innerHTML = `
      <h3 style="margin-bottom: 15px; color: #fff;">Showing ${filteredData.length} result(s)</h3>
      ${!hasAnyEmail ? '<div style="background: #27272a; padding: 12px; border-radius: 6px; margin-bottom: 15px; color: #a1a1aa; font-size: 14px;">⚠️ Email/username data is not available per-user for enterprise instances. Showing organization-level user list below.</div>' : ''}
      ${orgUsersSection}
      <div style="overflow-x: auto;">
        <table style="min-width: 1400px;">
          <thead>
            <tr>
              <th onclick="toggleSort('userId', 'number')" style="cursor: pointer;">User ID${getSortIcon('userId')}</th>
              <th onclick="toggleSort('queries_completed', 'number')" style="cursor: pointer;">Queries${getSortIcon('queries_completed')}</th>
              <th onclick="toggleSort('total_credits', 'number')" style="cursor: pointer;">Credits${getSortIcon('total_credits')}</th>
              <th onclick="toggleSort('completion_tokens', 'number')" style="cursor: pointer;">Completion Tokens${getSortIcon('completion_tokens')}</th>
              <th onclick="toggleSort('prompt_tokens', 'number')" style="cursor: pointer;">Prompt Tokens${getSortIcon('prompt_tokens')}</th>
              <th onclick="toggleSort('cached_tokens', 'number')" style="cursor: pointer;">Cached Tokens${getSortIcon('cached_tokens')}</th>
              <th onclick="toggleSort('total_tokens', 'number')" style="cursor: pointer;">Total Tokens${getSortIcon('total_tokens')}</th>
              <th onclick="toggleSort('total_tool_calls', 'number')" style="cursor: pointer;">Tool Calls${getSortIcon('total_tool_calls')}</th>
              <th onclick="toggleSort('error_count', 'number')" style="cursor: pointer;">Errors${getSortIcon('error_count')}</th>
              <th onclick="toggleSort('cancelled_count', 'number')" style="cursor: pointer;">Cancelled${getSortIcon('cancelled_count')}</th>
              <th onclick="toggleSort('first_search', 'date')" style="cursor: pointer;">First / Last${getSortIcon('first_search')}</th>
            </tr>
          </thead>
          <tbody>
            ${sortedData.map(row => `
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

async function loadOverageData(filter) {
  const container = document.getElementById('overages-content');
  container.innerHTML = '<p class="loading">Loading...</p>';

  try {
    const response = await fetch('/api/overages');
    const data = await response.json();

    if (data.error) {
      container.innerHTML = `<div class="error">Error: ${data.error}</div>`;
      return;
    }

    const filteredData = filter 
      ? data.filter(row => {
          const searchTerm = filter.toLowerCase();
          return (
            row.account_name?.toLowerCase().includes(searchTerm) ||
            row.external_url?.toLowerCase().includes(searchTerm)
          );
        })
      : data;

    const sortedData = sortData(filteredData, sortColumn, sortColumn === 'account_name' || sortColumn === 'month' || sortColumn === 'source_type' ? 'string' : 'number');

    container.innerHTML = `
      <h3 style="margin-bottom: 15px; color: #fff;">Showing ${filteredData.length} result(s)</h3>
      <table>
        <thead>
          <tr>
            <th onclick="toggleSort('account_name', 'string')" style="cursor: pointer;">Account${getSortIcon('account_name')}</th>
            <th onclick="toggleSort('month', 'string')" style="cursor: pointer;">Month${getSortIcon('month')}</th>
            <th onclick="toggleSort('deep_search_allocation', 'number')" style="cursor: pointer;">Allocation${getSortIcon('deep_search_allocation')}</th>
            <th onclick="toggleSort('ds_queries', 'number')" style="cursor: pointer;">Queries${getSortIcon('ds_queries')}</th>
            <th onclick="toggleSort('ds_users', 'number')" style="cursor: pointer;">Users${getSortIcon('ds_users')}</th>
            <th onclick="toggleSort('monthly_overage', 'number')" style="cursor: pointer;">Overage${getSortIcon('monthly_overage')}</th>
            <th onclick="toggleSort('source_type', 'string')" style="cursor: pointer;">Source${getSortIcon('source_type')}</th>
          </tr>
        </thead>
        <tbody>
          ${sortedData.map(row => `
            <tr>
              <td>
                <a class="org-link" onclick="selectOrg('${row.external_url}')">${row.account_name}</a>
                <div style="font-size: 12px; color: #71717a;">${row.external_url}</div>
              </td>
              <td>${row.month}</td>
              <td><span class="metric">${row.deep_search_allocation}</span></td>
              <td><span class="metric">${row.ds_queries}</span></td>
              <td><span class="metric">${row.ds_users}</span></td>
              <td><span class="overage">${row.monthly_overage ? row.monthly_overage.toFixed(1) : '0.0'}</span></td>
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

const eventDescriptions = {
  'deepsearch:search': 'Search initiated',
  'deepsearch:search.completed': 'Search completed successfully',
  'deepsearch:search.error': 'Search encountered an error',
  'deepsearch:search.cancelled': 'Search was cancelled by user',
  'deepsearch:search.toolcall': 'Tool/function call during search',
  'deepsearch:search.rawllm': 'Raw LLM call (individual model request)',
  'deepsearch:search.followup': 'Follow-up search query',
  'deepsearch:search.source.clicked': 'User clicked a source in results',
  'deepsearch:search.viewed': 'Search results viewed',
  'deepsearch:search.shared': 'Search results shared',
  'deepsearch:search.turn': 'Search conversation turn',
  'deepsearch:search.tokenlimitexceeded': 'Token limit exceeded during search',
  'deepsearch:search.externalclient': 'Search from external client',
  'deepsearch.quota.state:state': 'Quota state check'
};

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

    const sortedData = sortData(data, sortColumn, sortColumn === 'eventName' || sortColumn === 'externalUrl' ? 'string' : 'number');

    container.innerHTML = `
      <table>
        <thead>
          <tr>
            <th onclick="toggleSort('eventName', 'string')" style="cursor: pointer;">Event Name${getSortIcon('eventName')}</th>
            <th>Description</th>
            ${org ? '<th onclick="toggleSort(\'externalUrl\', \'string\')" style="cursor: pointer;">Organization' + getSortIcon('externalUrl') + '</th>' : ''}
            <th onclick="toggleSort('count', 'number')" style="cursor: pointer;">Count${getSortIcon('count')}</th>
            <th onclick="toggleSort('unique_users', 'number')" style="cursor: pointer;">Unique Users${getSortIcon('unique_users')}</th>
          </tr>
        </thead>
        <tbody>
          ${sortedData.map(row => `
            <tr>
              <td>${row.eventName}</td>
              <td style="color: #a1a1aa; font-size: 13px;">${eventDescriptions[row.eventName] || ''}</td>
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

// Auto-load when selecting from org dropdown
document.getElementById('orgFilter').addEventListener('change', () => {
  const value = document.getElementById('orgFilter').value;
  if (value && orgList.includes(value)) {
    loadData();
  }
});

loadData();
