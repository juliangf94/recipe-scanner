import os
import logging
import requests

SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_KEY', '')
BUCKET = 'recipe-images'
_BUCKET_PUBLIC_PATH = f'/storage/v1/object/public/{BUCKET}/'


def configured():
    return bool(SUPABASE_URL and SUPABASE_SERVICE_KEY)


def upload_file(file_bytes, path, content_type='image/jpeg'):
    """Upload bytes to Supabase Storage. Returns the public URL or None on failure."""
    if not configured():
        return None
    url = f'{SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}'
    headers = {
        'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}',
        'Content-Type': content_type,
        'x-upsert': 'true',
    }
    try:
        res = requests.post(url, headers=headers, data=file_bytes, timeout=15)
        if res.ok:
            return f'{SUPABASE_URL}{_BUCKET_PUBLIC_PATH}{path}'
        logging.error('Supabase upload failed %s: %s', res.status_code, res.text[:200])
    except Exception as exc:
        logging.error('Supabase Storage upload error: %s', exc)
    return None


def delete_file(path):
    """Delete a file from Supabase Storage by its path within the bucket."""
    if not configured() or not path:
        return
    url = f'{SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}'
    headers = {'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}'}
    try:
        requests.delete(url, headers=headers, timeout=10)
    except Exception as exc:
        logging.error('Supabase Storage delete error: %s', exc)


def path_from_url(url):
    """Extract the storage path from a Supabase public URL, or the bare filename from a local URL."""
    if not url:
        return None
    if _BUCKET_PUBLIC_PATH in url:
        return url.split(_BUCKET_PUBLIC_PATH, 1)[1]
    return url.rsplit('/', 1)[-1]
