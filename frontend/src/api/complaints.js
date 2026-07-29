// Complaint endpoints. Backend isn't up yet, so treat the request/response
// shapes here as PROVISIONAL.
// TODO(raja-api): confirm the exact contract for POST /api/complaints —
//   especially how the image is uploaded (multipart field name) and whether
//   category is sent as a name or a categoryId.
import { API_BASE_URL } from '../config';

function authHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Create a complaint. `payload` = { category, description, location, severity, image (File|null) }.
// Sent as multipart/form-data so the image can ride along in one request.
export async function createComplaint({ category, description, location, severity, image }) {
  const body = new FormData();
  body.append('category', category);
  body.append('description', description);
  body.append('location', location);
  body.append('severity', severity);
  if (image) body.append('image', image);

  let response;
  try {
    response = await fetch(`${API_BASE_URL}/complaints`, {
      method: 'POST',
      headers: { ...authHeaders() }, // no Content-Type: browser sets multipart boundary
      body,
    });
  } catch {
    throw new Error('Cannot reach the server. Is the backend running?');
  }

  let data = {};
  try {
    data = await response.json();
  } catch {
    /* non-JSON response */
  }
  if (!response.ok) {
    throw new Error(data.detail || `Could not submit complaint (${response.status})`);
  }
  return data;
}
