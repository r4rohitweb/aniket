from pathlib import Path
from html import escape

root = Path(__file__).resolve().parent.parent
icons = [
    '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6M7 10h6M10 7v6"/>',
    '<path d="m16 3 5 5-12 12H4v-5ZM13 6l5 5M4 21h17"/>',
    '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM20 2v4M18 4h4"/>',
    '<path d="m3 10 18-7-7 18-4-7ZM10 14 21 3"/>',
]
groups = [
    ('Research & SEO', 'Understand what people search for, find useful topics, and measure how content performs.', [
        ('SC', 'Google Search Console', 'Search performance'),
        ('GA', 'Google Analytics', 'Audience & content insights'),
        ('Ah', 'Ahrefs', 'Keywords & competitor research'),
        ('Se', 'Semrush', 'Keyword research & SEO'),
    ]),
    ('Writing & editing', 'Refine the draft, check readability, and keep the writing clear and original.', [
        ('Gr', 'Grammarly', 'Grammar & writing checks'),
        ('Re', 'Readable.com', 'Readability checks'),
        ('He', 'Hemingway Editor', 'Clarity & sentence editing'),
        ('Co', 'Copyleaks', 'Content originality checks'),
    ]),
    ('AI & ideas', 'Explore angles, support research, and work through ideas with an AI-assisted writing workflow.', [
        ('CG', 'ChatGPT', 'Ideas & draft exploration'),
        ('Cl', 'Claude', 'Writing & editorial support'),
        ('Ge', 'Gemini', 'Research & brainstorming'),
        ('Pe', 'Perplexity', 'Research & source discovery'),
    ]),
    ('Publishing & campaigns', 'Bring content to the page, build campaign sequences, and prepare supporting visuals.', [
        ('W', 'WordPress', 'Content publishing'),
        ('Mc', 'Mailchimp', 'Email campaigns'),
        ('Zo', 'Zoho Campaigns', 'Email marketing'),
        ('Br', 'Brevo', 'Campaign workflows'),
        ('Ca', 'Canva', 'Visuals & presentations'),
    ]),
]

section = '''<section class="writer-section writer-tools shell" id="tools" aria-labelledby="tools-title"><div class="writer-tools__intro"><div><p class="eyebrow">Tools I use</p><h2 id="tools-title">Behind the words.<br>Inside my toolkit.</h2></div><p class="writer-lead">From the first keyword to the final draft, these are the tools I use for research, writing, publishing, and campaigns.</p></div><div class="tool-groups">'''
for i, (name, description, tools) in enumerate(groups):
    icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + icons[i] + '</svg>'
    section += f'<article class="tool-group" aria-labelledby="tool-group-{i}"><div class="tool-group__heading"><span class="tool-group__icon">{icon}</span><h3 id="tool-group-{i}">{escape(name)}</h3><span class="tool-group__step" aria-hidden="true">0{i+1}</span></div><p class="tool-group__description">{escape(description)}</p><ul class="tool-list">'
    for initials, tool, role in tools:
        section += f'<li class="tool-item"><span class="tool-item__mark" aria-hidden="true">{initials}</span><div class="tool-item__text"><h4>{escape(tool)}</h4><p>{escape(role)}</p></div></li>'
    section += '</ul></article>'
section += '''</div><p class="tools-principle"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 8 4v5c0 4-4 7-8 9-4-2-8-5-8-9V7ZM8 12l3 3 5-6"/></svg><span>Tools support the process. Research, editing, and a clear brand voice guide the finished work.</span></p></section>'''

p = root / 'index.html'
s = p.read_text(encoding='utf-8')
assert 'id="tools"' not in s, 'Tools section already exists'
s = s.replace('<section class="writer-section credentials shell"', section + '\n<section class="writer-section credentials shell"', 1)
s = s.replace('<p class="eyebrow">The writer’s toolkit</p>', '<p class="eyebrow">My skills</p>', 1)
s = s.replace('<article><h3>Research &amp; publishing</h3><p>Google Search Console · Google Analytics · Ahrefs · Semrush · WordPress · Mailchimp · Zoho Campaigns · Brevo</p></article>', '<article><h3>Editorial &amp; team leadership</h3><p>Proofreading · Editorial feedback · Writer mentoring · Content quality control · Brand voice · Cross-team collaboration</p></article>')
s = s.replace('<article><h3>AI &amp; productivity</h3><p>ChatGPT · Claude · Gemini · Perplexity · Prompt engineering · Canva · Grammarly · Readable.com · Hemingway Editor</p></article>', '<article><h3>Planning &amp; workflows</h3><p>Editorial calendars · Content production · AI-assisted writing workflows · Prompt engineering · Online reputation management</p></article>')
s = s.replace('        <li><button data-go="certificates">', '        <li><button data-go="tools"><span data-h="y 0 -2|o .8 1" data-hs="320 22" data-ht="button">Tools</span></button></li>\n        <li><button data-go="certificates">', 1)
s = s.replace('<li><a href="./certificates" data-go="certificates">', '<li><a href="./tools" data-go="tools">Tools</a></li><li><a href="./certificates" data-go="certificates">', 1)
s = s.replace('(home|work|my-story|certificates)', '(home|work|my-story|certificates|tools)', 1)
s = s.replace('</head>', '<link rel="stylesheet" href="assets/tools.css?v=1">\n</head>', 1)
s = s.replace('assets/main.js?v=certificates-1', 'assets/main.js?v=tools-1')
p.write_text(s, encoding='utf-8')

p = root / 'assets/main.js'
s = p.read_text(encoding='utf-8')
s = s.replace("['Certificates','certificates']", "['Tools','tools'],['Certificates','certificates']", 1)
s = s.replace("certificates: 'certificates' };", "certificates: 'certificates', tools: 'tools' };", 1)
s = s.replace('(home|work|my-story|certificates)', '(home|work|my-story|certificates|tools)', 1)
s = s.replace("const first = location.hash === '#certificates'", "const first = location.hash === '#tools' || sectionRoute === 'tools' ? 'tools' : location.hash === '#certificates'", 1)
s = s.replace("['home', 'works', 'about', 'certificates'].forEach", "['home', 'works', 'about', 'tools', 'certificates'].forEach", 1)
p.write_text(s, encoding='utf-8')

p = root / '.htaccess'
s = p.read_text(encoding='utf-8').replace('home|work|my-story|certificates', 'home|work|my-story|certificates|tools')
p.write_text(s, encoding='utf-8')
p = root / 'README.md'
p.write_text(p.read_text(encoding='utf-8') + '\nThe dedicated `/tools` section groups 17 tools from the supplied resume and old portfolio by research, editing, AI, and publishing. Styles are in `assets/tools.css`.\n', encoding='utf-8')
print('Added 17 tools across 4 groups, plus desktop/mobile/footer navigation and /tools route.')
