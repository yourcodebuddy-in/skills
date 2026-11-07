import os,sys
sys.path.insert(0,os.getcwd())
from text.slug import slugify
sys.exit(0 if slugify(" A  b ")=="a-b" else 1)
