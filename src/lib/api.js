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
  return callAPI('getData')
}

export async function addOrder(order) {
  return callAPI('addOrder', order)
}

export async function addBatchOrders(orders) {
  return callAPI('addBatchOrders', { orders })
}

export async function updateCell(sheet, row, col, value) {
  return callAPI('updateCell', { sheet, row, col, value })
}

export async function bulkUpdateStatus(rows, status, extra = {}) {
  return callAPI('bulkUpdateStatus', { rows, status, ...extra })
}

export async function addStock(items) {
  return callAPI('addStock', { items })
}

export async function addProduct(product) {
  return callAPI('addProduct', product)
}

export async function updateProduct(row, product) {
  return callAPI('updateProduct', { row, ...product })
}

export async function saveProductImage(productCode, imageData) {
  return callAPI('saveProductImage', { productCode, imageData })
}

export async function saveAddress(customerName, address) {
  return callAPI('saveAddress', { customerName, ...address })
}

export async function shipItems(items) {
  return callAPI('shipItems', { items })
}

export async function markCK(rows, date) {
  return callAPI('markCK', { rows, date })
}

export async function cancelOrder(row) {
  return callAPI('cancelOrder', { row })
}

export async function getSheetsSummary() {
  return callAPI('getSheetsSummary')
}
