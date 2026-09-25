import { useEffect, useMemo, useState } from 'react'
import { Megaphone, Pencil, Plus, Trash2 } from 'lucide-react'
import { Card, ConfirmDialog, EmptyState } from '../../components/common/ui.jsx'
import { useRole } from '../../context/RoleContext.jsx'
import { getDb, describeDbError } from '../../lib/dbStore'
import { isRunningInsideArtifact } from '../../lib/artifactEnv'
import { generateId } from '../../lib/id'
import { formatDate } from '../../lib/format'
import { useProfiles } from '../../hooks/useProfiles'
import MuralPostForm from './MuralPostForm.jsx'

export default function MuralPage() {
  const { role, myId } = useRole()
  const canPost = role === 'admin'
  const [db, setDb] = useState(null)
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [editingPost, setEditingPost] = useState(undefined)
  const [pendingDelete, setPendingDelete] = useState(null)

  useEffect(() => {
    if (!isRunningInsideArtifact()) {
      setLoading(false)
      return undefined
    }
    let cancelled = false
    let unsubscribe = null
    getDb().then((resolvedDb) => {
      if (cancelled) return
      setDb(resolvedDb)
      if (!resolvedDb) {
        setLoading(false)
        return
      }
      unsubscribe = resolvedDb
        .collection('muralPosts')
        .orderBy('createdAt', 'desc')
        .onSnapshot(
          (snap) => {
            setPosts(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
            setLoading(false)
          },
          (error) => {
            setLoadError(describeDbError(error))
            setLoading(false)
          },
        )
    })
    return () => {
      cancelled = true
      if (unsubscribe) unsubscribe()
    }
  }, [])

  const authorIds = useMemo(() => posts.map((p) => p.authorId).filter(Boolean), [posts])
  const profiles = useProfiles(authorIds)

  async function handleSave(form) {
    if (!db) throw new Error('Mural indisponível nesta visualização.')
    try {
      if (editingPost) {
        await db.collection('muralPosts').doc(editingPost.id).update(form)
      } else {
        const id = generateId()
        await db
          .collection('muralPosts')
          .doc(id)
          .set({ ...form, authorId: myId, createdAt: new Date().toISOString() })
      }
    } catch (error) {
      throw new Error(describeDbError(error))
    }
  }

  async function handleDelete(post) {
    if (!db) return
    await db.collection('muralPosts').doc(post.id).delete()
    setPendingDelete(null)
  }

  if (!isRunningInsideArtifact() || (!loading && !db)) {
    return (
      <div>
        <div className="page-header">
          <h1>Mural</h1>
        </div>
        <Card>
          <EmptyState
            title="Mural disponível apenas no app publicado"
            description="O mural depende do banco de dados compartilhado da Claude — funciona na versão publicada como Artifact."
          />
        </Card>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Mural</h1>
          <p className="page-subtitle">Avisos e eventos do ministério</p>
        </div>
        {canPost && (
          <button type="button" className="btn btn-primary" onClick={() => setEditingPost(null)}>
            <Plus size={16} /> Novo aviso
          </button>
        )}
      </div>

      {loadError && <p style={{ color: 'var(--color-danger)' }}>{loadError}</p>}

      {loading ? (
        <p className="text-muted">Carregando…</p>
      ) : posts.length === 0 ? (
        <Card>
          <EmptyState
            title="Nenhum aviso publicado ainda"
            description={canPost ? 'Publique o primeiro evento ou aviso do ministério.' : 'Volte mais tarde para ver novidades.'}
          />
        </Card>
      ) : (
        <div className="grid" style={{ gap: 14 }}>
          {posts.map((post) => (
            <Card key={post.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <Megaphone size={20} color="var(--color-accent)" style={{ flexShrink: 0, marginTop: 3 }} />
                  <div>
                    <h3 style={{ margin: '0 0 4px' }}>{post.title}</h3>
                    <p className="text-muted" style={{ margin: '0 0 8px', fontSize: '0.82rem' }}>
                      {post.eventDate ? `Evento em ${formatDate(post.eventDate)} · ` : ''}
                      Por {profiles[post.authorId]?.name || 'alguém da administração'}
                    </p>
                    {post.body && <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{post.body}</p>}
                  </div>
                </div>
                {canPost && (
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setEditingPost(post)}
                      aria-label={`Editar ${post.title}`}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => setPendingDelete(post)}
                      aria-label={`Excluir ${post.title}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {editingPost !== undefined && (
        <MuralPostForm post={editingPost} onSave={handleSave} onClose={() => setEditingPost(undefined)} />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Excluir aviso"
          message={`Tem certeza que deseja excluir "${pendingDelete.title}"?`}
          confirmLabel="Excluir"
          onConfirm={() => handleDelete(pendingDelete)}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
}
