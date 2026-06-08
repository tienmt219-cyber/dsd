import { API_URL, API_PASSWORD } from './constants'

async function callAPI(action, data = {}) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action, pw: API_PASSWORD, ...data }),
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  const json = await res.json()
  if (json.error) throw new Error(json.error)
  return json
}

export async function getData() {
  const res = await fetch(API_URL)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  const json = await res.json()
  if (json.error) throw new Error(json.error)
  return json
}

export async function addOrder(order) {
  return callAPI('addOrder', { order })
}

export async function addBatchOrders(orders) {
  return callAPI('addBatchOrders', { orders })
}

export async function updateStatus(rowIndex, newStatus, verify) {
  return callAPI('updateStatus', { rowIndex, newStatus, verify })
}

export async function bulkUpdateStatus(items, tracking) {
  return callAPI('bulkUpdateStatus', { items, tracking })
}

export async function softDelete(rowIndex, verify) {
  return callAPI('softDelete', { rowIndex, verify })
}

export async function editOrder(rowIndex, fields, verify) {
  return callAPI('editOrder', { rowIndex, fields, verify })
}

export async function addStock(item) {
  return callAPI('addStock', { item })
}

export async function shipItems(items, tracking) {
  return callAPI('shipItems', { items, tracking })
}

export async function addProduct(product) {
  return callAPI('addProduct', { product })
}

export async function updateProduct(rowIndex, product) {
  return callAPI('updateProduct', { rowIndex, product })
}

export async function saveAddress(name, address, fb) {
  return callAPI('saveAddress', { name, address, fb })
}

export async function lookupOrders(name, phone) {
  return callAPI('lookupOrders', { name, phone })
}

export async function batchMarkCK(items) {
  return callAPI('batchMarkCK', { items })
}

export async function batchUnmarkCK(items) {
  return callAPI('batchUnmarkCK', { items })
}

export async function saveEMSHistory(ems) {
  return callAPI('saveEMSHistory', { ems })
}

export async function editEMSHistory(rowIndex, ems) {
  return callAPI('editEMSHistory', { rowIndex, ems })
}

export async function deleteEMSHistory(rowIndex) {
  return callAPI('deleteEMSHistory', { rowIndex })
}

export async function shipEMSWithStock(ems) {
  return callAPI('shipEMSWithStock', { ems })
}

export async function addSurplus(maSP, size, color, qty, status) {
  return callAPI('addSurplus', { maSP, size, color, qty, status })
}
