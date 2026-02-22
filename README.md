# NEXUS - Collaborative World Builder

https://pixelisedtree.github.io/Nexus-WorldBuilder/

A powerful, real-time collaborative tool for building interconnected worlds, stories, and knowledge graphs. Create nodes, link them together, add media, and collaborate with others across the internet.

## ✨ Features

### 🎨 Node System
- **6 default node types**: Character, Location, Item, Event, Faction, Concept
- **Custom node types**: Create unlimited custom types with default attributes
- **Rich properties**: Name, description, tags, custom attributes, color coding
- **Media attachments**: Images, audio files, and drawings

### 🔗 Connections
- Link nodes together with labeled relationships
- Add descriptions to connections
- Visual graph with directional arrows
- Right-click context menus for quick actions

### 🖼️ Media Support
- **Images**: Upload photos, concept art, screenshots
- **Audio**: Attach voice notes, music, sound effects
- **Drawings**: Built-in canvas for sketching and diagrams

### 🔍 Organization
- **Search**: Find nodes by name, description, tags, or attributes
- **Filters**: Filter by type or tags
- **Multiple views**: Graph view and list view
- **Templates**: Save nodes as reusable templates

### 🌐 Real-Time Collaboration
- **Internet collaboration**: Share room codes to collaborate from anywhere
- **Live cursors**: See other users' mouse positions
- **Instant sync**: All changes sync in real-time
- **Peer-to-peer**: No server required, uses WebRTC

## 🚀 Quick Start

### Single Player
1. Open `nexus-worldbuilder.html` in your browser
2. Start creating nodes and connections!

### Internet Collaboration
1. **Host the file publicly** (see deployment options below)
2. Open the hosted URL
3. You'll get a 6-character room code (e.g., `ABC123`)
4. Click "Share" to get the shareable URL
5. Send to collaborators - they'll join instantly!

## 🎯 How to Use

### Creating Nodes
- Click any node type button in the sidebar
- Or right-click canvas → choose node type
- Fill in name, description, tags, attributes
- Add media if needed

### Connecting Nodes
- **Method 1**: Click "Link" tool, click source node, then target node
- **Method 2**: Right-click node → "Create Link From Here"
- Add labels like "leads to", "allies with", "owns"

### Adding Media
1. Edit any node (Shift+click or right-click → Edit)
2. Click 📷 Image, 🎵 Audio, or ✏️ Drawing
3. Upload or create your content

### Custom Node Types
1. Click "Settings" button
2. Add Custom Node Type
3. Define name, color, default attributes

### Filtering
- Use search box for instant filtering
- Select type from dropdown
- Click tag badges to filter by tags

## 🌍 Deployment Options

To enable internet collaboration, host the HTML file publicly:

### Option 1: GitHub Pages (Recommended)
```bash
# 1. Create a new GitHub repository
# 2. Upload nexus-worldbuilder.html (rename to index.html)
# 3. Go to Settings → Pages → Enable Pages
# 4. Access at: yourusername.github.io/repo-name
```

### Option 2: Netlify
1. Go to [netlify.com](https://netlify.com)
2. Drag and drop `nexus-worldbuilder.html`
3. Get instant URL like: `your-site.netlify.app`

### Option 3: Vercel / Cloudflare Pages
Similar to Netlify - just drag and drop the file.

### Option 4: Temporary Tunnel (Testing)
```bash
# Install ngrok
npm install -g ngrok

# Tunnel local server
ngrok http 3000

# Share the https://xxx.ngrok.io URL
```

## 💾 Data Management

### Save & Load
- **Auto-save**: Saves to browser localStorage every 10 seconds
- **Manual save**: Click "Save" to download `.nexus.json` file
- **Load**: Click "Load" to import saved worlds

### Sharing
- **Live collaboration**: Share room URL for real-time editing
- **Static share**: Data encoded in URL hash (works without internet) **(Still W.I.P)**

## ⌨️ Keyboard Shortcuts

- **Shift + Click node**: Edit node
- **Right-click node**: Context menu
- **Right-click link**: Edit/delete connection
- **Mouse wheel**: Zoom in/out
- **Click + Drag**: Pan the canvas

## 🛠️ Technical Details

- **Single HTML file**: No build process required
- **No backend needed**: Peer-to-peer WebRTC
- **Browser support**: Modern browsers (Chrome, Firefox, Safari, Edge)
- **Data storage**: LocalStorage + PeerJS for sync
- **Libraries**: PeerJS for WebRTC connections

## 📝 Use Cases

- **World building**: Create fictional worlds, story universes
- **Game design**: Map out game mechanics, characters, locations
- **Knowledge graphs**: Organize research, notes, concepts
- **Brainstorming**: Mind mapping with rich media
- **RPG campaigns**: Track D&D characters, locations, quests
- **Project planning**: Visual project/team relationships

## 🔒 Privacy

- All data stays client-side (browser localStorage)
- Peer-to-peer connections (no central server)
- Media is embedded as base64 in the document
- No tracking or analytics

## 📄 License

This is a single-file web application. Feel free to modify and use for personal or commercial projects.

## 🐛 Known Limitations

- Media files increase save file size (use compression for large images)
- Peer connections may require port forwarding on restrictive networks
- Works best with 2-5 simultaneous collaborators

## 🤝 Contributing Ideas

Want to enhance NEXUS? Some ideas:
- Export to other formats (JSON, GraphML, Markdown)
- Import from existing tools
- Advanced graph layouts (Family-Tree, etc...)
- Timeline view for events
- Mobile touch optimization
- Cloud sync integration

---

**Made with 🎨 for world builders, storytellers, and creative minds**
