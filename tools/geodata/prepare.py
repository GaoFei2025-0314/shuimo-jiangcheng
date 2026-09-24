from pathlib import Path
import json, rasterio, numpy as np
from rasterio.merge import merge
from contextlib import ExitStack
root=Path(__file__).parent
bounds=(113.35,29.85,115.2,31.5)
report={}
for kind in ['DEM','WBM']:
 with ExitStack() as stack:
  sources=[stack.enter_context(rasterio.open(p)) for p in sorted(root.glob(f'Copernicus*_{kind}.tif'))]
  assert len(sources)==9
  a,t=merge(sources,bounds=bounds)
  profile=sources[0].profile.copy(); profile.update(driver='GTiff',width=a.shape[2],height=a.shape[1],transform=t,compress='deflate',tiled=True)
  name='wuhan-glo30-elevation.tif' if kind=='DEM' else 'wuhan-glo30-water-mask.tif'
  with rasterio.open(root/name,'w',**profile) as out:
   out.write(a)
   out.update_tags(source='Copernicus DEM GLO-30 Public / AWS COG',vertical_datum='EGM2008',description='Rectangular Wuhan region with margin; not administrative boundary clip')
  report[kind]={'file':name,'shape':list(a.shape),'crs':str(sources[0].crs),'pixel_degrees':list(sources[0].res),'bounds':list(bounds),'min':float(a.min()),'max':float(a.max()),'finite':bool(np.isfinite(a).all()),'bytes':(root/name).stat().st_size}
  print(report[kind],flush=True)
(root/'validation.json').write_text(json.dumps(report,indent=2))
# A reduced preview only; GeoTIFFs retain the original grid spacing.
from rasterio.enums import Resampling
with rasterio.open(root/'wuhan-glo30-elevation.tif') as d:
 h=d.read(1,out_shape=(900,1000),resampling=Resampling.average)
with rasterio.open(root/'wuhan-glo30-water-mask.tif') as d:
 water=d.read(1,out_shape=(900,1000),resampling=Resampling.nearest)
gy,gx=np.gradient(h,204,178)
shade=np.clip((1-gx*.8+gy*.6)/np.sqrt(1+gx*gx+gy*gy),.25,1)
t=np.clip(h/700,0,1)[...,None]
color=(np.array([192,204,170])*(1-t)+np.array([125,106,85])*t)*shade[...,None]
color[water>0]=[118,167,184]
with rasterio.open(root/'terrain-preview.png','w',driver='PNG',width=1000,height=900,count=3,dtype='uint8') as dst:
 dst.write(np.moveaxis(color.astype('uint8'),-1,0))
print('Preview written',flush=True)
