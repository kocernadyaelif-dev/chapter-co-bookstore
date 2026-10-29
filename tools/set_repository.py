"""Set the actual GitHub URL after publication; does not create a repository."""
import argparse,re
from pathlib import Path
parser=argparse.ArgumentParser();parser.add_argument('url');args=parser.parse_args()
url=args.url.rstrip('/')
if not re.fullmatch(r'https://github\.com/[A-Za-z0-9-]+/[A-Za-z0-9_.-]+',url):
    parser.error('Use the actual https://github.com/OWNER/REPOSITORY URL.')
(Path(__file__).resolve().parents[1]/'GitHubLink.txt').write_text(url+'\n',encoding='utf-8')
print('Link updated. Verify examiner access and replace the presentation title-slide URL.')
