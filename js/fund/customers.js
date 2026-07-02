// ============================================================
// 客户账套管理（CRUD + 切换）
// ============================================================

function refreshCustomerSelect() {
  const sel = document.getElementById('customer-select');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">全部客户</option>';
  customers.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    sel.appendChild(opt);
  });
  if (current && customers.some(c => c.id === current)) {
    sel.value = current;
  } else if (currentCustomerId && customers.some(c => c.id === currentCustomerId)) {
    sel.value = currentCustomerId;
  }
}

function switchCustomer(customerId) {
  currentCustomerId = customerId || null;
  refreshCustomerSelect();
  // 重绘当前页面
  refreshCurrentPage();
}

function openCustomerManager() {
  renderCustomerList();
  document.getElementById('modal-customer').classList.add('open');
}

function renderCustomerList() {
  const list = document.getElementById('customer-list');
  if (!list) return;
  if (customers.length === 0) {
    list.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text3);">暂无客户</div>';
    return;
  }
  list.innerHTML = customers.map(c => {
    const fundCount = funds.filter(f => f.customers?.[c.id]).length;
    return `<div class="customer-row" data-customer-id="${c.id}">
      <div style="flex:1;">
        <div style="font-weight:600;font-size:14px;">${c.name}</div>
        <div style="font-size:11px;color:var(--text3);">${fundCount} 只基金 · ${c.note || ''}</div>
      </div>
      <button class="btn btn-secondary btn-sm" onclick="editCustomer('${c.id}')" style="margin-right:4px;">编辑</button>
      <button class="btn btn-danger btn-sm" onclick="deleteCustomer('${c.id}')">删除</button>
    </div>`;
  }).join('');
}

function openAddCustomer() {
  document.getElementById('customer-form-title').textContent = '新增客户';
  document.getElementById('customer-name').value = '';
  document.getElementById('customer-note').value = '';
  document.getElementById('customer-edit-id').value = '';
  document.getElementById('modal-customer-form').classList.add('open');
}

function editCustomer(id) {
  const c = customers.find(x => x.id === id);
  if (!c) return;
  document.getElementById('customer-form-title').textContent = '编辑客户';
  document.getElementById('customer-name').value = c.name;
  document.getElementById('customer-note').value = c.note || '';
  document.getElementById('customer-edit-id').value = id;
  document.getElementById('modal-customer-form').classList.add('open');
}

function saveCustomer() {
  const name = document.getElementById('customer-name').value.trim();
  const note = document.getElementById('customer-note').value.trim();
  const editId = document.getElementById('customer-edit-id').value;
  if (!name) { alert('请输入客户名称'); return; }

  if (editId) {
    const c = customers.find(x => x.id === editId);
    if (c) { c.name = name; c.note = note; }
  } else {
    customers.push({ id: uuid(), name, note, createdAt: new Date().toISOString() });
  }
  DB.save('customers_v1', customers);
  closeModal('modal-customer-form');
  renderCustomerList();
  refreshCustomerSelect();
}

function deleteCustomer(id) {
  const c = customers.find(x => x.id === id);
  if (!c || !confirm(`确定删除客户"${c.name}"？\n该客户关联的基金数据不会删除，但不再归属此客户。`)) return;
  customers = customers.filter(x => x.id !== id);
  DB.save('customers_v1', customers);
  if (currentCustomerId === id) {
    currentCustomerId = null;
    refreshCustomerSelect();
  }
  renderCustomerList();
  refreshCurrentPage();
}
