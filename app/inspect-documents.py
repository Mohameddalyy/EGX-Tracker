"""Read-only inspection of retained responses. Text extraction is never fact verification."""
import json, hashlib, re, io, datetime
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
LIB = ROOT / 'data/research/evidence/library'
OUT = LIB / 'extracted'
OUT.mkdir(exist_ok=True)
INSPECTION_VERSION = 'response-inspection-2'

class Page(HTMLParser):
    def __init__(self):
        super().__init__(); self.skip=0; self.text=[]; self.links=[]; self.anchor=None
    def handle_starttag(self, tag, attrs):
        attrs=dict(attrs)
        if tag in ('script','style','noscript'): self.skip+=1
        if tag=='a' and attrs.get('href'): self.anchor={'href':attrs['href'],'text':''}
    def handle_endtag(self, tag):
        if tag in ('script','style','noscript'): self.skip=max(0,self.skip-1)
        if tag=='a' and self.anchor: self.links.append(self.anchor); self.anchor=None
    def handle_data(self, text):
        if not self.skip:
            self.text.append(text)
            if self.anchor: self.anchor['text']+=text

def inspect(body, expected_hash=None):
    digest=hashlib.sha256(body).hexdigest()
    if expected_hash and digest!=expected_hash: return {'status':'HASH_MISMATCH','sha256':digest}
    if body.lstrip().startswith(b'%PDF-'):
        try:
            pdf=PdfReader(io.BytesIO(body)); pages=[]
            for i,p in enumerate(pdf.pages):
                text=p.extract_text() or ''; image_count=0
                try:
                    resources=p.get('/Resources',{}).get_object(); objects=resources.get('/XObject',{}).get_object()
                    image_count=sum(1 for obj in objects.values() if obj.get_object().get('/Subtype')=='/Image')
                except (AttributeError,TypeError): pass
                pages.append({'page':i+1,'text':text,'imageCount':image_count,'numericTokens':len(re.findall(r'\d+(?:[,.]\d+)*',text))})
            sparse=[p['page'] for p in pages if len(re.sub(r'\s','',p['text']))<80 or p['imageCount']>0 and p['numericTokens']<5]
            return {'status':'PDF_TEXT_REVIEW_REQUIRED' if not sparse else 'PDF_OCR_OR_LAYOUT_REVIEW_REQUIRED','sha256':digest,'pages':pages,'pageCount':len(pages),'sparsePages':sparse,'publicationVerified':False}
        except Exception as e: return {'status':'PDF_PARSE_FAILED','sha256':digest,'error':str(e)}
    page=Page(); page.feed(body.decode('utf-8',errors='replace')); text=' '.join(' '.join(page.text).split())
    if re.search(r'access denied|request rejected|verify you are human|just a moment|captcha|enable javascript and cookies',text,re.I): status='CHALLENGE_OR_ACCESS_PAGE'
    elif re.search(r'loading news|loading disclosures',text,re.I): status='DYNAMIC_INDEX_NOT_DISCLOSURES'
    elif len(text)<300: status='EMPTY_OR_SCRIPT_SHELL'
    else: status='HTML_REVIEW_REQUIRED'
    return {'status':status,'sha256':digest,'text':text,'links':page.links,'publicationVerified':False}

def main():
    index=json.loads((LIB/'index.json').read_text(encoding='utf-8-sig')); results=[]; routes={}; reused=0; extracted=0
    for item in index['items'].values():
        if not item.get('bodyPath'): continue
        body=Path(item['bodyPath']).read_bytes(); digest=hashlib.sha256(body).hexdigest(); path=OUT/(digest+'.json')
        detail=None
        if digest==item.get('sha256') and path.exists():
            try:
                cached=json.loads(path.read_text(encoding='utf-8'))
                if cached.get('version')==INSPECTION_VERSION and cached.get('sha256')==digest:
                    detail=cached; reused+=1
            except (ValueError,OSError): pass
        if detail is None:
            detail={**inspect(body,item.get('sha256')), 'version':INSPECTION_VERSION}; extracted+=1
            path.write_text(json.dumps(detail,ensure_ascii=False),encoding='utf-8')
        results.append({'url':item['url'],'sha256':digest,'status':detail['status'],'extractionPath':str(path),'pages':detail.get('pageCount'),'publicationVerified':False})
        host=urlparse(item['url']).hostname or ''
        if 'tradingview.com' in host or detail['status']!='HTML_REVIEW_REQUIRED': continue
        for link in detail.get('links',[]):
            url=urljoin(item.get('finalUrl',item['url']),link['href']); parsed=urlparse(url)
            # Discover exact observed links, never synthesize issuer file paths.
            if parsed.scheme!='https' or not re.search(r'\.pdf(?:$|\?)|financial|disclosure|investor|قوائم|افصاح|إفصاح',url+' '+link['text'],re.I): continue
            if parsed.fragment: url=url.split('#')[0]
            routes.setdefault(url,{'url':url,'discoveredFrom':item['url'],'anchor':link['text'][:300],'reportIds':item.get('reportIds',[]),'sourceAuthority':'UNVERIFIED','factVerification':False})
    counts={}
    for x in results: counts[x['status']]=counts.get(x['status'],0)+1
    report={'version':INSPECTION_VERSION,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'counts':counts,'items':results,'extracted':extracted,'reused':reused,'factsVerifiedAutomatically':0}
    (LIB/'inspection.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    (LIB/'discovered-routes.json').write_text(json.dumps(list(routes.values()),ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'counts':counts,'extracted':extracted,'reused':reused,'discoveredRoutes':len(routes),'report':str(LIB/'inspection.json')}))

if __name__=='__main__': main()
