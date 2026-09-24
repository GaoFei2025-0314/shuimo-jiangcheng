from pathlib import Path
import urllib.request, concurrent.futures, hashlib, json, time
root=Path(__file__).parent
base='https://copernicus-dem-30m.s3.amazonaws.com/'
def fetch(args):
 lat,lon,kind=args
 stem=f'Copernicus_DSM_COG_10_N{lat:02}_00_E{lon:03}_00_DEM'
 name=stem+'.tif' if kind=='DEM' else stem.replace('_DEM','_WBM')+'.tif'
 key=stem+'/'+('' if kind=='DEM' else 'AUXFILES/')+name
 dest=root/name
 for attempt in range(3):
  try:
   with urllib.request.urlopen(base+key,timeout=90) as response:
    expected=int(response.headers['Content-Length'])
    with open(str(dest)+'.part','wb') as f:
     while chunk:=response.read(1024*1024): f.write(chunk)
   assert Path(str(dest)+'.part').stat().st_size==expected
   Path(str(dest)+'.part').replace(dest)
   digest=hashlib.sha256(dest.read_bytes()).hexdigest()
   print(name,expected,flush=True)
   return dict(file=name,url=base+key,bytes=expected,sha256=digest)
  except Exception:
   if attempt==2: raise
   time.sleep(2)
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
 entries=list(pool.map(fetch,[(lat,lon,k) for lat in [29,30,31] for lon in [113,114,115] for k in ['DEM','WBM']]))
(root/'manifest.json').write_text(json.dumps({'source':base,'extent':[113,29,116,32],'files':entries},indent=2))
print('COMPLETE',sum(e['bytes'] for e in entries),flush=True)
