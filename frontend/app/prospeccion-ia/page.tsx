'use client';

import Image from 'next/image';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  Copy,
  ClipboardList,
  Inbox,
  Lightbulb,
  Loader2,
  Mail,
  MessageSquareText,
  Plus,
  RefreshCw,
  Reply,
  Save,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';

const apiUrl = '';

type ProspectingList = {
  id: string;
  name: string;
  description: string | null;
  icp: Record<string, string>;
  status: string;
  source: string;
  total_prospects: number;
  researched_prospects: number;
  approved_prospects: number;
  created_at: string;
};

type ProspectMessage = {
  id: string;
  channel: string;
  step: number;
  subject: string | null;
  body: string;
  status: string;
  created_at?: string;
};

type ProspectActivity = {
  id: string;
  type: string;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

type Prospect = {
  id: string;
  company_name: string;
  website: string | null;
  linkedin_url: string | null;
  contact_name: string | null;
  contact_role: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  sector: string | null;
  company_size: string | null;
  status: string;
  fit_score: number | null;
  priority: string | null;
  notes: string | null;
  prospect_research?: {
    company_summary: string | null;
    pain_hypothesis: string | null;
    buying_signal: string | null;
    personalization_angle: string | null;
    recommended_offer: string | null;
    confidence: string;
  } | null;
  prospect_messages?: ProspectMessage[];
  prospect_activities?: ProspectActivity[];
};

type ListForm = {
  name: string;
  description: string;
  vertical: string;
  sector: string;
  country: string;
  targetRole: string;
  pain: string;
  offer: string;
};

type CampaignCriteriaForm = {
  vertical: string;
  sector: string;
  country: string;
  targetRole: string;
  pain: string;
  offer: string;
  companySize: string;
  excludedSectors: string;
  searchNotes: string;
};

type ProspeoUsage = {
  configured: boolean;
  date: string;
  searchUsed: number;
  searchLimit: number;
  searchRemaining: number;
  enrichUsed: number;
  enrichLimit: number;
  enrichRemaining: number;
};

type EmailStatus = {
  enabled: boolean;
  pollEnabled: boolean;
  fromAddress: string;
  provider?: string;
  graphConfigured?: boolean;
  graphMailbox?: string;
  smtpConfigured: boolean;
  imapConfigured: boolean;
  pollIntervalSeconds: number;
  usage?: {
    date: string;
    sentToday: number;
    dailyLimit: number;
    remainingToday: number;
  };
};

type CampaignSummary = {
  metrics: {
    totalProspects: number;
    researched: number;
    approved: number;
    discarded: number;
    sentEmails: number;
    replies: number;
    interested: number;
    later: number;
    notInterested: number;
    meetings: number;
    pendingFollowUps: number;
  };
  inbox: InboxItem[];
  followUps: FollowUpItem[];
  sequence: SequenceSummary;
};

type InboxItem = {
  id: string;
  prospectId: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  prospectStatus: string;
  subject: string;
  body: string;
  outcome: string;
  nextFollowUpAt: string;
  createdAt: string;
};

type FollowUpItem = {
  id: string;
  prospectId: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  outcome: string;
  nextFollowUpAt: string;
  overdue: boolean;
  note: string;
};

type SequenceSummary = {
  delayDays: number;
  metrics: {
    missingEmail: number;
    pendingFirstEmail: number;
    waitingReply: number;
    readyFollowUp: number;
    responded: number;
    stopped: number;
  };
  actions: SequenceAction[];
};

type SequenceAction = {
  prospectId: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  prospectStatus: string;
  outcome: string;
  type: string;
  label: string;
  detail: string;
  lastSentAt?: string;
  lastActivityAt?: string;
  nextMessageId?: string | null;
  nextMessageSubject?: string;
};

type ProspeoForm = {
  jobTitles: string;
  locations: string;
  industries: string;
  companyKeywords: string;
  maxResults: number;
  confirmSpend: boolean;
};

type OutreachForm = {
  channel: string;
  contactName: string;
  contactEmail: string;
  subject: string;
  body: string;
  outreachStatus: string;
  nextFollowUpAt: string;
  notes: string;
};

type ResponseForm = {
  classification: string;
  responseText: string;
  nextFollowUpAt: string;
  notes: string;
};

const emptyListForm: ListForm = {
  name: '',
  description: '',
  vertical: '',
  sector: '',
  country: '',
  targetRole: '',
  pain: '',
  offer: '',
};

const emptyCampaignCriteriaForm: CampaignCriteriaForm = {
  vertical: '',
  sector: '',
  country: '',
  targetRole: '',
  pain: '',
  offer: '',
  companySize: '',
  excludedSectors: '',
  searchNotes: '',
};

const emptyProspeoForm: ProspeoForm = {
  jobTitles: 'gerente, director, responsable mantenimiento, operaciones',
  locations: 'Alicante, Spain',
  industries: '',
  companyKeywords: '',
  maxResults: 10,
  confirmSpend: false,
};

const prospectingVerticals = [
  {
    id: 'industrial_foia_castalla',
    label: 'Industrial Foia de Castalla',
    badge: 'Prioridad',
    description: 'Búsqueda de fabricantes con procesos de plástico, agua refrigerada, climatización industrial y salas blancas.',
    listName: 'Industrial Foia de Castalla',
    sector: 'Plastics Manufacturing, Plastics and Rubber Product Manufacturing',
    country: 'Ibi, Spain; Castalla, Spain; Onil, Spain; Tibi, Spain; Villena, Spain; Biar, Spain; Alcoy, Spain; Banyeres, Spain',
    targetRole: 'gerente, director de operaciones, responsable de mantenimiento, responsable de producción, responsable de planta',
    companySize: '11-50, 50-200, 200+',
    pain: 'Paradas de producción por temperatura inestable, procesos de inyección o extrusión que necesitan agua refrigerada, consumo energético alto, mantenimiento reactivo, calidad afectada por temperatura o humedad.',
    offer: 'Diagnóstico técnico de refrigeración y climatización de proceso para estabilizar producción, revisar agua refrigerada/chillers y planificar mantenimiento preventivo.',
    excludedSectors: 'Residencial, comercios, hostelería, freelancers, formación, servicios sin proceso productivo, empresas fuera de la zona objetivo',
    searchNotes: 'Priorizar empresas de inyección, extrusión, transformación de plásticos, moldes, packaging, termoplásticos, salas blancas o procesos que dependan de agua refrigerada. No mezclar con aerotermia residencial.',
    companyKeywords: 'inyección de plásticos, extrusión de plásticos, moldes, termoplásticos, inyectora, sala blanca, agua refrigerada, chiller, plastic injection molding',
  },
];

const workflowSteps = [
  { id: 'authority', number: '01', title: 'Estrategia', description: 'Vertical industrial y alcance.', icon: Sparkles },
  { id: 'linkedin', number: '02', title: 'Ideas LinkedIn', description: 'Contenido y aprobación.', icon: Lightbulb },
  { id: 'criteria', number: '03', title: 'Criterios', description: 'Lista, ICP y filtros.', icon: SlidersHorizontal },
  { id: 'search', number: '04', title: 'Búsqueda', description: 'Prospeo controlado.', icon: Search },
  { id: 'communication', number: '05', title: 'Comunicación', description: 'Email, respuestas y panel.', icon: Mail },
  { id: 'prospects', number: '06', title: 'Prospectos', description: 'Mensajes, IA e historial.', icon: Building2 },
];

type WorkspaceTab = typeof workflowSteps[number]['id'];

type LinkedinAccount = { id: string; name: string; role: string; line: string };
type LinkedinPain = { id: string; label: string; text: string };
type LinkedinVertical = { id: string; label: string; source: string; premise: string; offer: string; pains: LinkedinPain[] };
type LinkedinOption = { id: string; label: string; guidance?: string };
type Frequency = Record<string, { postsPerWeek: number; preferredDays: string[] }>;
type LinkedinContext = {
  accounts: LinkedinAccount[];
  verticals: LinkedinVertical[];
  angles: LinkedinOption[];
  drivers: LinkedinOption[];
  formats: LinkedinOption[];
  settings: { frequency: Frequency };
};
type LinkedinIdea = {
  id: string;
  accountId: string;
  accountName: string;
  verticalId: string;
  verticalLabel: string;
  painId: string;
  painLabel: string;
  angleId: string;
  angleLabel: string;
  driverId: string;
  driverLabel: string;
  formatId: string;
  formatLabel: string;
  title: string;
  body: string;
  cta: string;
  status: 'pendiente' | 'aprobada' | 'rechazada' | 'programada' | 'publicada';
  scheduledFor: string | null;
  createdAt: string;
  updatedAt: string;
};
type LinkedinIdeasPayload = {
  data: LinkedinIdea[];
  summary: { total: number; pending: number; approved: number; rejected: number; scheduled: number };
};

const emptyLinkedinIdeas: LinkedinIdeasPayload = {
  data: [],
  summary: { total: 0, pending: 0, approved: 0, rejected: 0, scheduled: 0 },
};
const linkedinDays = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes'];

const emptyOutreachForm: OutreachForm = {
  channel: 'EMAIL',
  contactName: '',
  contactEmail: '',
  subject: '',
  body: '',
  outreachStatus: 'CONTACTADO',
  nextFollowUpAt: '',
  notes: '',
};

const emptyResponseForm: ResponseForm = {
  classification: 'INTERESADO',
  responseText: '',
  nextFollowUpAt: '',
  notes: '',
};

const sampleImport = `Empresa,Web,Contacto,Cargo,Email,Sector,Ciudad,Pais,Tamano
Acme Industrial,acmeindustrial.com,Ana Lopez,Directora Comercial,ana@acmeindustrial.com,Industria,Alicante,Espana,50-200
Beta Facility,betafacility.es,Carlos Ruiz,Gerente,carlos@betafacility.es,Servicios,Valencia,Espana,11-50`;

export default function AiProspectingPage() {
  const [lists, setLists] = useState<ProspectingList[]>([]);
  const [selectedListId, setSelectedListId] = useState('');
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<WorkspaceTab>('authority');
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [selectedProspectId, setSelectedProspectId] = useState('');
  const [loadingLists, setLoadingLists] = useState(true);
  const [loadingProspects, setLoadingProspects] = useState(false);
  const [creatingList, setCreatingList] = useState(false);
  const [savingCriteria, setSavingCriteria] = useState(false);
  const [importing, setImporting] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [savingMessageId, setSavingMessageId] = useState<string | null>(null);
  const [archivingListId, setArchivingListId] = useState<string | null>(null);
  const [deletingListId, setDeletingListId] = useState<string | null>(null);
  const [prospectFilter, setProspectFilter] = useState('TODOS');
  const [prospeoUsage, setProspeoUsage] = useState<ProspeoUsage | null>(null);
  const [prospeoForm, setProspeoForm] = useState<ProspeoForm>(emptyProspeoForm);
  const [searchingProspeo, setSearchingProspeo] = useState(false);
  const [savingOutreach, setSavingOutreach] = useState(false);
  const [savingResponse, setSavingResponse] = useState(false);
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);
  const [pollingEmail, setPollingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<EmailStatus | null>(null);
  const [campaignSummary, setCampaignSummary] = useState<CampaignSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [classifyingActivityId, setClassifyingActivityId] = useState<string | null>(null);
  const [highlightMessageId, setHighlightMessageId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [listForm, setListForm] = useState<ListForm>(emptyListForm);
  const [criteriaForm, setCriteriaForm] = useState<CampaignCriteriaForm>(emptyCampaignCriteriaForm);
  const [csvText, setCsvText] = useState('');
  const [messageDrafts, setMessageDrafts] = useState<Record<string, { subject: string; body: string }>>({});
  const [outreachForm, setOutreachForm] = useState<OutreachForm>(emptyOutreachForm);
  const [responseForm, setResponseForm] = useState<ResponseForm>(emptyResponseForm);
  const [linkedinContext, setLinkedinContext] = useState<LinkedinContext | null>(null);
  const [linkedinIdeas, setLinkedinIdeas] = useState<LinkedinIdeasPayload>(emptyLinkedinIdeas);
  const [loadingLinkedinIdeas, setLoadingLinkedinIdeas] = useState(true);
  const [generatingLinkedinIdeas, setGeneratingLinkedinIdeas] = useState(false);
  const [linkedinStatusFilter, setLinkedinStatusFilter] = useState('');
  const [linkedinAccountId, setLinkedinAccountId] = useState('davofrio');
  const [linkedinVerticalId, setLinkedinVerticalId] = useState('industrial_ibi_foia');
  const [linkedinPainId, setLinkedinPainId] = useState('');
  const [linkedinAngleId, setLinkedinAngleId] = useState('dolor');
  const [linkedinDriverId, setLinkedinDriverId] = useState('');
  const [linkedinFormatId, setLinkedinFormatId] = useState('post_corto');
  const [linkedinCount, setLinkedinCount] = useState(6);
  const [linkedinFrequency, setLinkedinFrequency] = useState<Frequency>({});

  const selectedList = useMemo(
    () => lists.find((list) => list.id === selectedListId) || null,
    [lists, selectedListId],
  );

  const selectedVertical = useMemo(
    () => prospectingVerticals.find((item) => item.id === criteriaForm.vertical || item.id === selectedList?.icp?.vertical) || null,
    [criteriaForm.vertical, selectedList],
  );

  const selectedLinkedinVertical = useMemo(
    () => linkedinContext?.verticals.find((item) => item.id === linkedinVerticalId) || linkedinContext?.verticals[0],
    [linkedinContext, linkedinVerticalId],
  );

  const selectedProspect = useMemo(
    () => prospects.find((prospect) => prospect.id === selectedProspectId) || null,
    [prospects, selectedProspectId],
  );

  const filteredProspects = useMemo(() => {
    if (!prospectFilter || prospectFilter === 'TODOS') return prospects;
    if (prospectFilter === 'CONTACTADO') {
      return prospects.filter((prospect) => deriveContactState(prospect).status !== 'SIN_CONTACTAR');
    }
    return prospects.filter((prospect) => prospect.status === prospectFilter);
  }, [prospects, prospectFilter]);

  const visibleProspect = selectedProspect || filteredProspects[0] || prospects[0] || null;
  const selectedMessage = useMemo(
    () => visibleProspect?.prospect_messages?.find((item) => item.status === 'APROBADO') ||
      visibleProspect?.prospect_messages?.[0] ||
      null,
    [visibleProspect],
  );
  const visibleContactState = useMemo(() => deriveContactState(visibleProspect), [visibleProspect]);

  const filterCounts = useMemo(() => ({
    TODOS: prospects.length,
    NUEVO: prospects.filter((prospect) => prospect.status === 'NUEVO').length,
    MENSAJE_GENERADO: prospects.filter((prospect) => prospect.status === 'MENSAJE_GENERADO').length,
    APROBADO: prospects.filter((prospect) => prospect.status === 'APROBADO').length,
    DESCARTADO: prospects.filter((prospect) => prospect.status === 'DESCARTADO').length,
    CONTACTADO: prospects.filter((prospect) => deriveContactState(prospect).status !== 'SIN_CONTACTAR').length,
  }), [prospects]);

  const selectedListMetrics = campaignSummary?.metrics || {
    totalProspects: prospects.length,
    researched: prospects.filter((prospect) => ['INVESTIGADO', 'MENSAJE_GENERADO', 'APROBADO', 'CONVERTIDO'].includes(prospect.status)).length,
    approved: prospects.filter((prospect) => ['APROBADO', 'CONVERTIDO'].includes(prospect.status)).length,
    discarded: prospects.filter((prospect) => prospect.status === 'DESCARTADO').length,
    sentEmails: prospects.reduce((total, prospect) => total + (prospect.prospect_messages || []).filter((item) => item.channel === 'EMAIL' && ['ENVIADO', 'RESPONDIDO'].includes(item.status)).length, 0),
    replies: prospects.reduce((total, prospect) => total + (prospect.prospect_activities || []).filter((item) => item.metadata?.emailDirection === 'inbound' || item.metadata?.responseText).length, 0),
    interested: 0,
    later: 0,
    notInterested: 0,
    meetings: 0,
    pendingFollowUps: 0,
  };

  const sequenceSummary = campaignSummary?.sequence || {
    delayDays: 3,
    metrics: {
      missingEmail: 0,
      pendingFirstEmail: 0,
      waitingReply: 0,
      readyFollowUp: 0,
      responded: 0,
      stopped: 0,
    },
    actions: [],
  };

  const criteriaReadiness = useMemo(() => {
    const items = [
      { label: 'Sector', ready: Boolean(criteriaForm.sector.trim()) },
      { label: 'Ubicación', ready: Boolean(criteriaForm.country.trim() || prospeoForm.locations.trim()) },
      { label: 'Cargo objetivo', ready: Boolean(criteriaForm.targetRole.trim() || prospeoForm.jobTitles.trim()) },
      { label: 'Dolor/oferta', ready: Boolean(criteriaForm.pain.trim() && criteriaForm.offer.trim()) },
    ];
    return {
      items,
      readyCount: items.filter((item) => item.ready).length,
      total: items.length,
    };
  }, [criteriaForm, prospeoForm.jobTitles, prospeoForm.locations]);

  const loadLists = useCallback(async () => {
    setLoadingLists(true);
    setMessage('');
    try {
      const response = await fetch(`${apiUrl}/api/prospecting/lists`, { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || body.detail || 'No se pudieron cargar las listas.');
      const nextLists = body.data || [];
      setLists(nextLists);
      setSelectedListId((current) => current || nextLists[0]?.id || '');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error desconocido.');
    } finally {
      setLoadingLists(false);
    }
  }, []);

  const loadProspeoUsage = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/api/prospecting/prospeo/usage`, { cache: 'no-store' });
      const body = await response.json();
      if (response.ok) setProspeoUsage(body.data || null);
    } catch {
      setProspeoUsage(null);
    }
  }, []);

  const loadEmailStatus = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/api/prospecting/email/status`, { cache: 'no-store' });
      const body = await response.json();
      if (response.ok) setEmailStatus(body.data || null);
    } catch {
      setEmailStatus(null);
    }
  }, []);

  const loadCampaignSummary = useCallback(async (listId: string) => {
    if (!listId) {
      setCampaignSummary(null);
      return;
    }
    setLoadingSummary(true);
    try {
      const response = await fetch(`${apiUrl}/api/prospecting/lists/${listId}/summary`, { cache: 'no-store' });
      const body = await response.json();
      if (response.ok) setCampaignSummary(body.data || null);
    } catch {
      setCampaignSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  const loadProspects = useCallback(async (listId: string) => {
    if (!listId) {
      setProspects([]);
      return;
    }
    setLoadingProspects(true);
    setMessage('');
    try {
      const response = await fetch(`${apiUrl}/api/prospecting/lists/${listId}/prospects`, { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || body.detail || 'No se pudieron cargar los prospectos.');
      setProspects(body.data || []);
      setSelectedProspectId((current) => body.data?.some((item: Prospect) => item.id === current) ? current : body.data?.[0]?.id || '');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error desconocido.');
    } finally {
      setLoadingProspects(false);
    }
  }, []);

  const loadLinkedinIdeas = useCallback(async () => {
    setLoadingLinkedinIdeas(true);
    try {
      const query = linkedinStatusFilter ? `?status=${encodeURIComponent(linkedinStatusFilter)}` : '';
      const [contextResponse, ideasResponse] = await Promise.all([
        fetch(`${apiUrl}/api/prospecting/linkedin/context`, { cache: 'no-store' }),
        fetch(`${apiUrl}/api/prospecting/linkedin/ideas${query}`, { cache: 'no-store' }),
      ]);
      if (contextResponse.status === 401 || ideasResponse.status === 401) {
        window.location.replace('/prospeccion-login');
        return;
      }
      const contextBody = await contextResponse.json();
      const ideasBody = await ideasResponse.json();
      if (!contextResponse.ok) throw new Error(contextBody.error || contextBody.detail || 'No se pudo cargar el contexto de LinkedIn.');
      if (!ideasResponse.ok) throw new Error(ideasBody.error || ideasBody.detail || 'No se pudieron cargar las ideas de LinkedIn.');
      const context = contextBody.data as LinkedinContext;
      setLinkedinContext(context);
      setLinkedinFrequency(context.settings?.frequency || {});
      setLinkedinIdeas({
        data: ideasBody.data || [],
        summary: ideasBody.summary || emptyLinkedinIdeas.summary,
      });
      setLinkedinAccountId((current) => context.accounts.some((item) => item.id === current) ? current : context.accounts[0]?.id || '');
      setLinkedinVerticalId((current) => context.verticals.some((item) => item.id === current) ? current : context.verticals[0]?.id || '');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error desconocido al cargar LinkedIn.');
    } finally {
      setLoadingLinkedinIdeas(false);
    }
  }, [linkedinStatusFilter]);

  useEffect(() => {
    loadLists();
    loadProspeoUsage();
    loadEmailStatus();
  }, [loadLists, loadProspeoUsage, loadEmailStatus]);

  useEffect(() => {
    loadLinkedinIdeas();
  }, [loadLinkedinIdeas]);

  useEffect(() => {
    if (!selectedLinkedinVertical) return;
    setLinkedinPainId((current) => (
      selectedLinkedinVertical.pains.some((pain) => pain.id === current)
        ? current
        : selectedLinkedinVertical.pains[0]?.id || ''
    ));
  }, [selectedLinkedinVertical]);

  useEffect(() => {
    loadProspects(selectedListId);
    loadCampaignSummary(selectedListId);
  }, [selectedListId, loadProspects, loadCampaignSummary]);

  useEffect(() => {
    const icp = selectedList?.icp || {};
    const nextCriteria = {
      vertical: readIcpString(icp, 'vertical'),
      sector: readIcpString(icp, 'sector'),
      country: readIcpString(icp, 'country'),
      targetRole: readIcpString(icp, 'targetRole'),
      pain: readIcpString(icp, 'pain'),
      offer: readIcpString(icp, 'offer'),
      companySize: readIcpString(icp, 'companySize'),
      excludedSectors: readIcpString(icp, 'excludedSectors'),
      searchNotes: readIcpString(icp, 'searchNotes'),
    };
    setCriteriaForm(nextCriteria);
    setProspeoForm((current) => ({
      ...current,
      jobTitles: nextCriteria.targetRole || current.jobTitles,
      locations: nextCriteria.country || current.locations,
      industries: nextCriteria.sector || current.industries,
      companyKeywords: readIcpString(icp, 'companyKeywords') || current.companyKeywords,
      confirmSpend: false,
    }));
  }, [selectedList]);

  function applyVerticalPreset(verticalId: string, target: 'list' | 'criteria' = 'criteria') {
    const preset = prospectingVerticals.find((item) => item.id === verticalId);
    if (!preset) return;

    if (target === 'list') {
      setListForm((current) => ({
        ...current,
        name: current.name || preset.listName,
        description: current.description || preset.description,
        vertical: preset.id,
        sector: preset.sector,
        country: preset.country,
        targetRole: preset.targetRole,
        pain: preset.pain,
        offer: preset.offer,
      }));
    }

    setCriteriaForm((current) => ({
      ...current,
      vertical: preset.id,
      sector: preset.sector,
      country: preset.country,
      targetRole: preset.targetRole,
      companySize: preset.companySize,
      pain: preset.pain,
      offer: preset.offer,
      excludedSectors: preset.excludedSectors,
      searchNotes: preset.searchNotes,
    }));
    setProspeoForm((current) => ({
      ...current,
      jobTitles: preset.targetRole,
      locations: preset.country,
      industries: preset.sector,
      companyKeywords: preset.companyKeywords,
      confirmSpend: false,
    }));
    setMessage(`${preset.label} aplicado. Revisa criterios antes de autorizar Prospeo.`);
  }

  async function generateLinkedinIdeas(event: FormEvent) {
    event.preventDefault();
    setGeneratingLinkedinIdeas(true);
    setMessage('');
    try {
      const response = await fetch(`${apiUrl}/api/prospecting/linkedin/ideas/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: linkedinAccountId,
          verticalId: linkedinVerticalId,
          painId: linkedinPainId,
          angleId: linkedinAngleId,
          driverId: linkedinDriverId,
          formatId: linkedinFormatId,
          count: linkedinCount,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || body.detail || 'No se pudieron generar las ideas.');
      setMessage(`${body.generated || 0} ideas generadas dentro de Prospección.`);
      await loadLinkedinIdeas();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error desconocido.');
    } finally {
      setGeneratingLinkedinIdeas(false);
    }
  }

  async function updateLinkedinIdeaStatus(id: string, updates: Partial<LinkedinIdea>) {
    setMessage('');
    try {
      const response = await fetch(`${apiUrl}/api/prospecting/linkedin/ideas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || body.detail || 'No se pudo actualizar la idea.');
      await loadLinkedinIdeas();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error desconocido.');
    }
  }

  async function copyLinkedinIdea(idea: LinkedinIdea) {
    await navigator.clipboard.writeText([idea.title, idea.body, idea.cta].filter(Boolean).join('\n\n'));
    setMessage('Idea de LinkedIn copiada.');
  }

  async function saveLinkedinSettings() {
    setMessage('');
    try {
      const response = await fetch(`${apiUrl}/api/prospecting/linkedin/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frequency: linkedinFrequency }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || body.detail || 'No se pudo guardar la configuración.');
      setMessage('Frecuencia de publicación guardada.');
      await loadLinkedinIdeas();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error desconocido.');
    }
  }

  useEffect(() => {
    const drafts: Record<string, { subject: string; body: string }> = {};
    for (const item of visibleProspect?.prospect_messages || []) {
      drafts[item.id] = { subject: item.subject || '', body: item.body || '' };
    }
    setMessageDrafts(drafts);
  }, [visibleProspect]);

  useEffect(() => {
    setOutreachForm({
      ...emptyOutreachForm,
      channel: selectedMessage?.channel || 'EMAIL',
      contactName: visibleProspect?.contact_name || '',
      contactEmail: visibleProspect?.email || '',
      subject: selectedMessage?.subject || '',
      body: selectedMessage?.body || '',
    });
    setResponseForm(emptyResponseForm);
  }, [selectedMessage, visibleProspect]);

  async function createList(event: FormEvent) {
    event.preventDefault();
    setCreatingList(true);
    setMessage('');
    try {
      const response = await fetch(`${apiUrl}/api/prospecting/lists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: listForm.name,
          description: listForm.description,
          icp: {
            vertical: listForm.vertical,
            sector: listForm.sector,
            country: listForm.country,
            targetRole: listForm.targetRole,
            pain: listForm.pain,
            offer: listForm.offer,
          },
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || body.detail || 'No se pudo crear la lista.');
      setListForm(emptyListForm);
      setSelectedListId(body.data.id);
      await loadLists();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error desconocido.');
    } finally {
      setCreatingList(false);
    }
  }

  async function saveCampaignCriteria(event: FormEvent) {
    event.preventDefault();
    if (!selectedListId || !selectedList) return;

    setSavingCriteria(true);
    setMessage('');
    try {
      const response = await fetch(`${apiUrl}/api/prospecting/lists/${selectedListId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          icp: {
            ...(selectedList.icp || {}),
            vertical: criteriaForm.vertical,
            sector: criteriaForm.sector,
            country: criteriaForm.country,
            targetRole: criteriaForm.targetRole,
            pain: criteriaForm.pain,
            offer: criteriaForm.offer,
            companySize: criteriaForm.companySize,
            excludedSectors: criteriaForm.excludedSectors,
            searchNotes: criteriaForm.searchNotes,
            companyKeywords: prospeoForm.companyKeywords,
          },
          status: selectedList.status === 'BORRADOR' ? 'REVISION' : selectedList.status,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || body.detail || 'No se pudieron guardar los criterios.');
      setProspeoForm((current) => ({
        ...current,
        jobTitles: criteriaForm.targetRole || current.jobTitles,
        locations: criteriaForm.country || current.locations,
        industries: criteriaForm.sector || current.industries,
        confirmSpend: false,
      }));
      setMessage('Criterios guardados. La búsqueda real sigue bloqueada hasta que autorices Prospeo.');
      await loadLists();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error desconocido.');
    } finally {
      setSavingCriteria(false);
    }
  }

  async function importProspects(event: FormEvent) {
    event.preventDefault();
    if (!selectedListId) return;
    const parsed = parseCsvLike(csvText);
    if (!parsed.length) {
      setMessage('Pega al menos una fila con empresa.');
      return;
    }
    setImporting(true);
    setMessage('');
    try {
      const response = await fetch(`${apiUrl}/api/prospecting/lists/${selectedListId}/prospects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospects: parsed }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || body.detail || 'No se pudieron importar los prospectos.');
      setCsvText('');
      const skippedText = body.skipped ? ` ${body.skipped} duplicados omitidos.` : '';
      setMessage(`${body.inserted || 0} prospectos importados.${skippedText}`);
      await Promise.all([loadLists(), loadProspects(selectedListId), loadCampaignSummary(selectedListId)]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error desconocido.');
    } finally {
      setImporting(false);
    }
  }

  async function generateProspect(prospectId: string) {
    setGeneratingId(prospectId);
    setMessage('');
    try {
      const response = await fetch(`${apiUrl}/api/prospecting/prospects/${prospectId}/generate-ai`, { method: 'POST' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || body.detail || 'No se pudo generar la investigacion.');
      setSelectedProspectId(prospectId);
      await Promise.all([loadLists(), loadProspects(selectedListId), loadCampaignSummary(selectedListId)]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error desconocido.');
    } finally {
      setGeneratingId(null);
    }
  }

  async function generatePendingProspects() {
    if (!selectedListId) return;
    setBulkGenerating(true);
    setMessage('');
    try {
      const response = await fetch(`${apiUrl}/api/prospecting/lists/${selectedListId}/generate-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: Math.max(25, prospects.length), scope: 'missing' }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || body.detail || 'No se pudo generar el lote.');
      const skippedText = body.skipped ? ` ${body.skipped} ya tenian investigacion.` : '';
      setMessage(`${body.generated || 0} prospectos investigados para revision.${skippedText}`);
      await Promise.all([loadLists(), loadProspects(selectedListId), loadCampaignSummary(selectedListId)]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error desconocido.');
    } finally {
      setBulkGenerating(false);
    }
  }

  async function searchProspeo(event: FormEvent) {
    event.preventDefault();
    if (!selectedListId) {
      setMessage('Selecciona o crea una lista antes de buscar en Prospeo.');
      return;
    }
    if (!prospeoForm.confirmSpend) {
      setMessage('Marca la casilla de autorización para usar 1 búsqueda de Prospeo.');
      return;
    }

    setSearchingProspeo(true);
    setMessage('');
    try {
      const response = await fetch(`${apiUrl}/api/prospecting/lists/${selectedListId}/prospeo/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobTitles: prospeoForm.jobTitles,
          locations: prospeoForm.locations,
          industries: prospeoForm.industries,
          companyKeywords: prospeoForm.companyKeywords,
          maxResults: prospeoForm.maxResults,
          confirmSpend: prospeoForm.confirmSpend,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || body.detail || 'No se pudo buscar en Prospeo.');
      setProspeoForm((current) => ({ ...current, confirmSpend: false }));
      setProspeoUsage(body.usage || null);
      setMessage(`${body.inserted || 0} prospectos importados desde Prospeo. ${body.skipped || 0} duplicados omitidos. Búsquedas restantes hoy: ${body.usage?.searchRemaining ?? '—'}.`);
      await Promise.all([loadLists(), loadProspects(selectedListId), loadCampaignSummary(selectedListId), loadProspeoUsage()]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error desconocido.');
      await loadProspeoUsage();
    } finally {
      setSearchingProspeo(false);
    }
  }

  async function updateProspectStatus(prospectId: string, status: string) {
    setMessage('');
    try {
      const response = await fetch(`${apiUrl}/api/prospecting/prospects/${prospectId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || body.detail || 'No se pudo actualizar el prospecto.');
      await Promise.all([loadLists(), loadProspects(selectedListId), loadCampaignSummary(selectedListId)]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error desconocido.');
    }
  }

  async function archiveSelectedList() {
    if (!selectedListId || !selectedList) return;
    const confirmed = window.confirm(`Archivar "${selectedList.name}"? No se borran los datos, solo se oculta de las listas activas.`);
    if (!confirmed) return;

    setArchivingListId(selectedListId);
    setMessage('');
    try {
      const response = await fetch(`${apiUrl}/api/prospecting/lists/${selectedListId}`, { method: 'DELETE' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || body.detail || 'No se pudo archivar la lista.');
      setSelectedListId('');
      setProspects([]);
      setSelectedProspectId('');
      setMessage('Lista archivada.');
      await loadLists();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error desconocido.');
    } finally {
      setArchivingListId(null);
    }
  }

  async function deleteSelectedList() {
    if (!selectedListId || !selectedList) return;
    const firstConfirmed = window.confirm(`Eliminar definitivamente "${selectedList.name}"? Esto borra la lista, prospectos, mensajes e historial de esta campaña.`);
    if (!firstConfirmed) return;

    const typed = window.prompt('Escribe ELIMINAR para confirmar el borrado definitivo.');
    if (typed !== 'ELIMINAR') {
      setMessage('Eliminación cancelada.');
      return;
    }

    setDeletingListId(selectedListId);
    setMessage('');
    try {
      const response = await fetch(`${apiUrl}/api/prospecting/lists/${selectedListId}?hard=true&confirm=ELIMINAR`, { method: 'DELETE' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || body.detail || 'No se pudo eliminar la lista.');
      setSelectedListId('');
      setProspects([]);
      setSelectedProspectId('');
      setCampaignSummary(null);
      setMessage('Lista eliminada definitivamente.');
      await loadLists();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error desconocido.');
    } finally {
      setDeletingListId(null);
    }
  }

  async function readCsvFile(file?: File) {
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
    setMessage(`${file.name} cargado para importar.`);
  }

  async function copyMessage(item: ProspectMessage) {
    const draft = messageDrafts[item.id] || { subject: item.subject || '', body: item.body || '' };
    const content = [draft.subject && `Asunto: ${draft.subject}`, draft.body].filter(Boolean).join('\n\n');
    await navigator.clipboard.writeText(content);
    setMessage('Mensaje copiado.');
  }

  function updateMessageDraft(messageId: string, field: 'subject' | 'body', value: string) {
    setMessageDrafts((current) => ({
      ...current,
      [messageId]: {
        subject: current[messageId]?.subject || '',
        body: current[messageId]?.body || '',
        [field]: value,
      },
    }));
  }

  async function saveProspectMessage(messageId: string, status?: string) {
    const draft = messageDrafts[messageId];
    if (!draft?.body.trim()) {
      setMessage('El mensaje no puede quedar vacío.');
      return;
    }

    setSavingMessageId(messageId);
    setMessage('');
    try {
      const response = await fetch(`${apiUrl}/api/prospecting/messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: draft.subject,
          body: draft.body,
          ...(status ? { status } : {}),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || body.detail || 'No se pudo guardar el mensaje.');
      setMessage(status ? `Mensaje marcado como ${status}.` : 'Mensaje guardado.');
      await Promise.all([loadProspects(selectedListId), loadCampaignSummary(selectedListId)]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error desconocido.');
    } finally {
      setSavingMessageId(null);
    }
  }

  async function sendEmailMessage(item: ProspectMessage) {
    if (!visibleProspect?.email && !outreachForm.contactEmail) {
      setMessage('Agrega un email de contacto antes de enviar.');
      return;
    }

    const confirmed = window.confirm(`Enviar email desde ${emailStatus?.fromAddress || 'la cuenta configurada'} a ${outreachForm.contactEmail || visibleProspect.email}?`);
    if (!confirmed) return;

    const draft = messageDrafts[item.id] || { subject: item.subject || '', body: item.body || '' };
    setSendingEmailId(item.id);
    setMessage('');
    try {
      const response = await fetch(`${apiUrl}/api/prospecting/messages/${item.id}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: draft.subject,
          body: draft.body,
          to: outreachForm.contactEmail || visibleProspect.email,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || body.detail || 'No se pudo enviar el email.');
      setMessage('Email enviado y seguimiento guardado.');
      await Promise.all([loadLists(), loadProspects(selectedListId), loadCampaignSummary(selectedListId), loadEmailStatus()]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error desconocido.');
    } finally {
      setSendingEmailId(null);
    }
  }

  function prepareSequenceAction(item: SequenceAction) {
    setProspectFilter('TODOS');
    setSelectedProspectId(item.prospectId);
    setHighlightMessageId(item.nextMessageId || null);
    setActiveWorkspaceTab('prospects');
    if (item.nextMessageId) {
      setMessage('Mensaje seleccionado para revisión. Confirma el contenido y usa “Enviar email” cuando esté listo.');
    } else if (item.type === 'MISSING_EMAIL') {
      setMessage('Este prospecto necesita email antes de poder entrar en la secuencia.');
    } else {
      setMessage('Prospecto seleccionado para revisar la acción de secuencia.');
    }
  }

  async function pollEmailReplies() {
    setPollingEmail(true);
    setMessage('');
    try {
      const response = await fetch(`${apiUrl}/api/prospecting/email/poll-now`, { method: 'POST' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || body.detail || 'No se pudo revisar el correo.');
      const processed = body.data?.processed || 0;
      const skipped = body.data?.skipped || 0;
      setMessage(`${processed} respuestas registradas. ${skipped} correos ignorados por no pertenecer a Prospección IA.`);
      await Promise.all([loadProspects(selectedListId), loadCampaignSummary(selectedListId)]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error desconocido.');
    } finally {
      setPollingEmail(false);
    }
  }

  async function saveOutreach(event: FormEvent) {
    event.preventDefault();
    if (!visibleProspect) return;

    setSavingOutreach(true);
    setMessage('');
    try {
      const response = await fetch(`${apiUrl}/api/prospecting/prospects/${visibleProspect.id}/outreach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(outreachForm),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || body.detail || 'No se pudo guardar el seguimiento.');
      setMessage('Seguimiento guardado en Prospección IA.');
      await Promise.all([loadLists(), loadProspects(selectedListId), loadCampaignSummary(selectedListId)]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error desconocido.');
    } finally {
      setSavingOutreach(false);
    }
  }

  async function saveResponse(event: FormEvent) {
    event.preventDefault();
    if (!visibleProspect) return;

    setSavingResponse(true);
    setMessage('');
    try {
      const response = await fetch(`${apiUrl}/api/prospecting/prospects/${visibleProspect.id}/response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(responseForm),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || body.detail || 'No se pudo guardar la respuesta.');
      setResponseForm(emptyResponseForm);
      setMessage('Respuesta registrada en el historial.');
      await Promise.all([loadLists(), loadProspects(selectedListId), loadCampaignSummary(selectedListId)]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error desconocido.');
    } finally {
      setSavingResponse(false);
    }
  }

  async function classifyInboxItem(item: InboxItem, classification: string) {
    setClassifyingActivityId(item.id);
    setMessage('');
    try {
      const nextFollowUpAt = classification === 'MAS_TARDE' ? futureDateTimeLocal(7) : '';
      const response = await fetch(`${apiUrl}/api/prospecting/activities/${item.id}/outcome`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classification, nextFollowUpAt }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || body.detail || 'No se pudo clasificar la respuesta.');
      setSelectedProspectId(item.prospectId);
      setActiveWorkspaceTab('prospects');
      setMessage(`Respuesta marcada como ${classification.replace(/_/g, ' ')}.`);
      await Promise.all([loadLists(), loadProspects(selectedListId), loadCampaignSummary(selectedListId)]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error desconocido.');
    } finally {
      setClassifyingActivityId(null);
    }
  }

  async function logoutProspecting() {
    try {
      await fetch('/api/prospecting/auth/logout', { method: 'POST', credentials: 'same-origin' });
    } finally {
      window.location.replace('/prospeccion-login');
    }
  }

  function openProspectDetail(prospectId: string) {
    setProspectFilter('TODOS');
    setSelectedProspectId(prospectId);
    setActiveWorkspaceTab('prospects');
  }

  function toggleProspectFilter(filter: string) {
    setProspectFilter((current) => current === filter ? '' : filter);
  }

  const activeTab = workflowSteps.find((step) => step.id === activeWorkspaceTab) || workflowSteps[0];

  return (
    <div className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="border-b border-slate-200 bg-[#082b5b] px-4 py-5 text-white lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r lg:border-blue-900/20">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white p-1.5 shadow-sm">
            <Image src="/icon.png" alt="Davofrío" width={42} height={42} priority />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-extrabold tracking-wide">DAVOFRÍO</p>
            <p className="text-xs font-medium text-blue-200">Prospección IA</p>
          </div>
        </div>

        <div className="my-5 h-px bg-white/10" />
        <p className="mb-2 px-2 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-300">Módulos</p>
        <nav className="grid gap-1 sm:grid-cols-2 lg:grid-cols-1">
          {workflowSteps.map((step) => {
            const Icon = step.icon;
            const active = activeWorkspaceTab === step.id;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveWorkspaceTab(step.id)}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${active ? 'bg-white text-[#082b5b] shadow-sm' : 'text-blue-100 hover:bg-white/10 hover:text-white'}`}
              >
                <Icon size={18} />
                <span className="min-w-0">
                  <span className="block">{step.title}</span>
                  <span className={`block truncate text-xs font-medium ${active ? 'text-slate-500' : 'text-blue-200'}`}>{step.description}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-3">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-200">Lista activa</p>
          <p className="mt-2 truncate text-sm font-semibold text-white">{selectedList?.name || 'Sin lista seleccionada'}</p>
          <p className="mt-1 text-xs text-blue-200">{prospects.length} prospectos cargados</p>
        </div>

        <button
          onClick={logoutProspecting}
          className="mt-4 w-full rounded-xl border border-white/10 px-3 py-2.5 text-left text-sm font-semibold text-white hover:bg-white/10"
        >
          Salir
        </button>
      </aside>

      <main className="p-6 lg:p-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-500">Prospeccion externa</p>
            <h2 className="mt-1 text-3xl font-bold text-slate-950">Centro de Prospección Davofrío</h2>
            <p className="mt-2 text-sm text-slate-500">
              {activeTab.number} · {activeTab.title}: {activeTab.description}
            </p>
          </div>
          <button
            onClick={loadLists}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            <RefreshCw size={17} />
            Actualizar
          </button>
        </div>

      {message && (
        <div className="mb-5 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
          {message}
        </div>
      )}

      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <Metric icon={<ClipboardList size={20} />} label="Listas" value={lists.length} />
        <Metric icon={<Building2 size={20} />} label="Prospectos" value={lists.reduce((total, list) => total + (list.total_prospects || 0), 0)} />
        <Metric icon={<Sparkles size={20} />} label="Investigados" value={lists.reduce((total, list) => total + (list.researched_prospects || 0), 0)} />
      </section>

      {activeWorkspaceTab === 'authority' && (
        <>
      <SectionHeader
        number="01"
        title="Estrategia de prospección"
        description="Define la vertical industrial antes de crear listas, buscar prospectos o autorizar consumo de créditos."
      />

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Vertical de campaña</p>
            <h3 className="mt-1 text-lg font-bold text-slate-950">Industrial Foia de Castalla</h3>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              Esta pantalla queda dedicada a búsqueda, autoridad LinkedIn y seguimiento de prospectos industriales, todo dentro de Prospección.
            </p>
          </div>
          {selectedVertical && (
            <span className="rounded-full bg-slate-950 px-3 py-1.5 text-xs font-bold text-white">
              Activa: {selectedVertical.label}
            </span>
          )}
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {prospectingVerticals.map((vertical) => (
            <button
              key={vertical.id}
              type="button"
              onClick={() => applyVerticalPreset(vertical.id)}
              className={`rounded-lg border p-4 text-left transition ${criteriaForm.vertical === vertical.id ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
            >
              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${criteriaForm.vertical === vertical.id ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-700'}`}>
                {vertical.badge}
              </span>
              <span className="mt-2 block text-sm font-bold">{vertical.label}</span>
              <span className={`mt-1 block text-sm ${criteriaForm.vertical === vertical.id ? 'text-slate-200' : 'text-slate-500'}`}>
                {vertical.description}
              </span>
            </button>
          ))}
        </div>
        {selectedVertical && (
          <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Preset cargado</p>
                <h4 className="mt-1 font-bold text-slate-950">{selectedVertical.label}</h4>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                  Ya se cargaron sector, ubicación, cargos, dolor, oferta y exclusiones. El siguiente paso es revisar esos criterios antes de crear lista o autorizar Prospeo.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setActiveWorkspaceTab('criteria')}
                  className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-bold text-white hover:bg-slate-800"
                >
                  Preparar criterios
                </button>
                <button
                  type="button"
                  onClick={() => setActiveWorkspaceTab('search')}
                  className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-bold text-blue-800 hover:bg-blue-50"
                >
                  Ir a búsqueda
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
        </>
      )}

      {activeWorkspaceTab === 'linkedin' && (
        <>
          <SectionHeader
            number="02"
            title="Ideas LinkedIn"
            description="Genera propuestas de publicación desde los dolores del documento, separadas por cuenta y vertical para aprobar antes de publicar."
          />

          <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <CampaignMetric label="Pendientes" value={linkedinIdeas.summary.pending} tone="blue" />
            <CampaignMetric label="Aprobadas" value={linkedinIdeas.summary.approved} tone="emerald" />
            <CampaignMetric label="Programadas" value={linkedinIdeas.summary.scheduled} tone="amber" />
            <CampaignMetric label="Rechazadas" value={linkedinIdeas.summary.rejected} tone="rose" />
          </section>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-6">
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Lightbulb size={18} className="text-slate-500" />
                      <h3 className="font-bold text-slate-950">Generador de ideas</h3>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      Elige cuenta, dolor, ángulo y formato. Esto no publica nada; solo crea ideas para revisión.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={loadLinkedinIdeas}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                  >
                    <RefreshCw size={16} />
                    Actualizar
                  </button>
                </div>

                <form onSubmit={generateLinkedinIdeas} className="mt-4 grid gap-4 lg:grid-cols-2">
                  <Field label="Cuenta donde se publicará">
                    <select value={linkedinAccountId} onChange={(event) => setLinkedinAccountId(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5">
                      {linkedinContext?.accounts.map((account) => (
                        <option key={account.id} value={account.id}>{account.name} · {account.role}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Vertical">
                    <select value={linkedinVerticalId} onChange={(event) => setLinkedinVerticalId(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5">
                      {linkedinContext?.verticals.map((vertical) => (
                        <option key={vertical.id} value={vertical.id}>{vertical.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Dolor">
                    <select value={linkedinPainId} onChange={(event) => setLinkedinPainId(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5">
                      {selectedLinkedinVertical?.pains.map((pain) => (
                        <option key={pain.id} value={pain.id}>{pain.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Ángulo">
                    <select value={linkedinAngleId} onChange={(event) => setLinkedinAngleId(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5">
                      <option value="">Rotar ángulos</option>
                      {linkedinContext?.angles.map((angle) => (
                        <option key={angle.id} value={angle.id}>{angle.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Driver">
                    <select value={linkedinDriverId} onChange={(event) => setLinkedinDriverId(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5">
                      <option value="">Rotar drivers</option>
                      {linkedinContext?.drivers.map((driver) => (
                        <option key={driver.id} value={driver.id}>{driver.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Formato">
                    <select value={linkedinFormatId} onChange={(event) => setLinkedinFormatId(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5">
                      <option value="">Rotar formatos</option>
                      {linkedinContext?.formats.map((format) => (
                        <option key={format.id} value={format.id}>{format.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Cantidad">
                    <input type="number" min={1} max={12} value={linkedinCount} onChange={(event) => setLinkedinCount(Number(event.target.value))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5" />
                  </Field>
                  <div className="flex items-end">
                    <button disabled={generatingLinkedinIdeas || !linkedinContext} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
                      {generatingLinkedinIdeas ? <Loader2 className="animate-spin" size={17} /> : <Sparkles size={17} />}
                      {generatingLinkedinIdeas ? 'Generando...' : 'Generar ideas'}
                    </button>
                  </div>
                </form>

                {selectedLinkedinVertical && (
                  <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Contexto aplicado</p>
                    <p className="mt-1 text-sm font-semibold text-slate-950">{selectedLinkedinVertical.premise}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{selectedLinkedinVertical.offer}</p>
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-950">Bandeja de ideas</h3>
                    <p className="mt-1 text-sm text-slate-500">{linkedinIdeas.summary.total} ideas en el filtro actual.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: '', label: 'Todas' },
                      { id: 'pendiente', label: 'Pendientes' },
                      { id: 'aprobada', label: 'Aprobadas' },
                      { id: 'programada', label: 'Programadas' },
                      { id: 'rechazada', label: 'Rechazadas' },
                    ].map((item) => (
                      <button
                        key={item.id || 'all'}
                        type="button"
                        onClick={() => setLinkedinStatusFilter((current) => current === item.id ? '' : item.id)}
                        className={`rounded-full px-3 py-1.5 text-xs font-bold ${linkedinStatusFilter === item.id ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4 grid gap-3">
                  {loadingLinkedinIdeas && <p className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">Cargando ideas...</p>}
                  {!loadingLinkedinIdeas && linkedinIdeas.data.map((idea) => (
                    <article key={idea.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <LinkedinStatusBadge status={idea.status} />
                            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">{idea.accountName}</span>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{idea.verticalLabel}</span>
                          </div>
                          <h4 className="mt-3 text-base font-bold text-slate-950">{idea.title}</h4>
                          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">{idea.body}</p>
                          {idea.cta && <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">{idea.cta}</p>}
                          <p className="mt-3 text-xs font-semibold text-slate-500">
                            {idea.painLabel} · {idea.angleLabel} · {idea.driverLabel} · {idea.formatLabel}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <button type="button" onClick={() => copyLinkedinIdea(idea)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50">
                            <Copy size={16} />
                            Copiar
                          </button>
                          <button type="button" onClick={() => updateLinkedinIdeaStatus(idea.id, { status: 'aprobada' })} className="rounded-lg border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">
                            Aprobar
                          </button>
                          <button type="button" onClick={() => updateLinkedinIdeaStatus(idea.id, { status: 'rechazada' })} className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50">
                            Rechazar
                          </button>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap items-end gap-3">
                        <Field label="Programar">
                          <input
                            type="datetime-local"
                            value={toDateTimeLocal(idea.scheduledFor)}
                            onChange={(event) => updateLinkedinIdeaStatus(idea.id, { scheduledFor: event.target.value, status: event.target.value ? 'programada' : idea.status })}
                            className="rounded-lg border border-slate-300 px-3 py-2.5"
                          />
                        </Field>
                        {idea.scheduledFor && (
                          <p className="pb-3 text-xs font-semibold text-slate-500">Fecha: {formatDate(idea.scheduledFor)}</p>
                        )}
                      </div>
                    </article>
                  ))}
                  {!loadingLinkedinIdeas && !linkedinIdeas.data.length && (
                    <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center">
                      <Lightbulb className="mx-auto text-slate-400" size={24} />
                      <p className="mt-2 text-sm font-semibold text-slate-700">Todavía no hay ideas en este filtro.</p>
                      <p className="mt-1 text-sm text-slate-500">Genera nuevas propuestas desde el panel superior.</p>
                    </div>
                  )}
                </div>
              </section>
            </div>

            <aside className="space-y-6">
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <Settings size={18} className="text-slate-500" />
                  <h3 className="font-bold text-slate-950">Frecuencia</h3>
                </div>
                <p className="mt-1 text-sm text-slate-500">Planifica cuánto publica cada cuenta. No publica automáticamente.</p>
                <div className="mt-4 space-y-4">
                  {linkedinContext?.accounts.map((account) => {
                    const config = linkedinFrequency[account.id] || { postsPerWeek: 1, preferredDays: [] };
                    return (
                      <div key={account.id} className="rounded-lg border border-slate-200 p-3">
                        <p className="text-sm font-bold text-slate-950">{account.name}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{account.line}</p>
                        <Field label="Posts por semana">
                          <input
                            type="number"
                            min={0}
                            max={7}
                            value={config.postsPerWeek}
                            onChange={(event) => setLinkedinFrequency((current) => ({
                              ...current,
                              [account.id]: { ...config, postsPerWeek: Number(event.target.value) },
                            }))}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                          />
                        </Field>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {linkedinDays.map((day) => {
                            const active = config.preferredDays.includes(day);
                            return (
                              <button
                                key={day}
                                type="button"
                                onClick={() => setLinkedinFrequency((current) => ({
                                  ...current,
                                  [account.id]: {
                                    ...config,
                                    preferredDays: active
                                      ? config.preferredDays.filter((item) => item !== day)
                                      : [...config.preferredDays, day],
                                  },
                                }))}
                                className={`rounded-full px-2.5 py-1 text-xs font-bold ${active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}
                              >
                                {day.slice(0, 3)}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button type="button" onClick={saveLinkedinSettings} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
                  <Save size={16} />
                  Guardar frecuencia
                </button>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <CalendarDays size={18} className="text-slate-500" />
                  <h3 className="font-bold text-slate-950">Uso en demo</h3>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  La pestaña permite mostrar que la estrategia de contenido nace de los mismos dolores de prospección, pero queda separada por cuenta para no mezclar DAVOFRIO, Adrián y Juan.
                </p>
              </section>
            </aside>
          </div>
        </>
      )}

      {activeWorkspaceTab === 'criteria' && (
        <>
      <SectionHeader
        number="03"
        title="Preparar lista y criterios"
        description="Aquí se crea o selecciona la lista, se fija el ICP y se deja Prospeo listo, pero sin gastar créditos hasta autorizar."
      />

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Plus size={18} className="text-slate-500" />
              <h3 className="font-bold text-slate-950">Nueva lista</h3>
            </div>
            <div className="mt-4 grid gap-2">
              {prospectingVerticals.map((vertical) => (
                <button
                  key={vertical.id}
                  type="button"
                  onClick={() => applyVerticalPreset(vertical.id, 'list')}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Usar preset: {vertical.label}
                </button>
              ))}
            </div>
            <form onSubmit={createList} className="mt-5 space-y-4">
              <Field label="Nombre">
                <input required value={listForm.name} onChange={(event) => setListForm({ ...listForm, name: event.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2.5" placeholder="Empresas industriales Alicante" />
              </Field>
              <Field label="Vertical">
                <select value={listForm.vertical} onChange={(event) => setListForm({ ...listForm, vertical: event.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2.5">
                  <option value="">Sin vertical</option>
                  {prospectingVerticals.map((vertical) => (
                    <option key={vertical.id} value={vertical.id}>{vertical.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Sector">
                <input value={listForm.sector} onChange={(event) => setListForm({ ...listForm, sector: event.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2.5" placeholder="Industria, hospitality, facility..." />
              </Field>
              <Field label="Cargo objetivo">
                <input value={listForm.targetRole} onChange={(event) => setListForm({ ...listForm, targetRole: event.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2.5" placeholder="Gerente, operaciones, compras..." />
              </Field>
              <Field label="Dolor principal">
                <textarea value={listForm.pain} onChange={(event) => setListForm({ ...listForm, pain: event.target.value })} rows={3} className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2.5" placeholder="Reducir trabajo manual, mejorar seguimiento..." />
              </Field>
              <Field label="Oferta">
                <textarea value={listForm.offer} onChange={(event) => setListForm({ ...listForm, offer: event.target.value })} rows={3} className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2.5" placeholder="Auditoria, demo, diagnostico..." />
              </Field>
              <button disabled={creatingList} className="w-full rounded-lg bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
                {creatingList ? 'Creando...' : 'Crear lista'}
              </button>
            </form>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-bold text-slate-950">Listas</h3>
            <div className="mt-4 space-y-2">
              {loadingLists && <p className="text-sm text-slate-500">Cargando listas...</p>}
              {lists.map((list) => (
                <div
                  key={list.id}
                  className={`rounded-lg border transition ${selectedListId === list.id ? 'border-slate-900 bg-slate-950 text-white' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                >
                  <button onClick={() => setSelectedListId(list.id)} className="block w-full px-3 py-3 text-left">
                    <span className="block text-sm font-bold">{list.name}</span>
                    <span className={`mt-1 block text-xs ${selectedListId === list.id ? 'text-slate-300' : 'text-slate-500'}`}>
                      {list.total_prospects || 0} prospectos · {list.researched_prospects || 0} investigados · {list.approved_prospects || 0} aprobados
                    </span>
                  </button>
                </div>
              ))}
              {!loadingLists && !lists.length && <p className="text-sm text-slate-500">Crea la primera lista para empezar.</p>}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Upload size={18} className="text-slate-500" />
                  <h3 className="font-bold text-slate-950">Carga manual opcional</h3>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedList ? selectedList.name : 'Selecciona o crea una lista.'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50">
                  <Upload size={16} />
                  CSV
                  <input type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => readCsvFile(event.target.files?.[0])} />
                </label>
                <button type="button" onClick={() => setCsvText(sampleImport)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50">
                  Usar ejemplo
                </button>
              </div>
            </div>
            <form onSubmit={importProspects} className="mt-4">
              <textarea
                disabled={!selectedListId}
                value={csvText}
                onChange={(event) => setCsvText(event.target.value)}
                rows={7}
                className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2.5 font-mono text-xs disabled:bg-slate-50"
                placeholder="Empresa,Web,Contacto,Cargo,Email,Sector,Ciudad,Pais,Tamano"
              />
              <button disabled={!selectedListId || importing} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                {importing ? <Loader2 className="animate-spin" size={17} /> : <Upload size={17} />}
                {importing ? 'Importando...' : 'Importar a la lista'}
              </button>
            </form>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <SlidersHorizontal size={18} className="text-slate-500" />
                  <h3 className="font-bold text-slate-950">Criterios de campaña</h3>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedList ? selectedList.name : 'Selecciona una lista para preparar la búsqueda.'}
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${criteriaReadiness.readyCount === criteriaReadiness.total ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
                {criteriaReadiness.readyCount}/{criteriaReadiness.total} listos
              </span>
            </div>
            <form onSubmit={saveCampaignCriteria} className="mt-4 grid gap-4 lg:grid-cols-2">
              <Field label="Vertical">
                <select
                  disabled={!selectedListId}
                  value={criteriaForm.vertical}
                  onChange={(event) => applyVerticalPreset(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-50"
                >
                  <option value="">Seleccionar vertical</option>
                  {prospectingVerticals.map((vertical) => (
                    <option key={vertical.id} value={vertical.id}>{vertical.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Sector objetivo">
                <input
                  disabled={!selectedListId}
                  value={criteriaForm.sector}
                  onChange={(event) => setCriteriaForm({ ...criteriaForm, sector: event.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-50"
                  placeholder="Industria, hoteles, clínicas..."
                />
              </Field>
              <Field label="Ubicación">
                <input
                  disabled={!selectedListId}
                  value={criteriaForm.country}
                  onChange={(event) => setCriteriaForm({ ...criteriaForm, country: event.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-50"
                  placeholder="Alicante, Valencia, Colombia..."
                />
              </Field>
              <Field label="Cargo objetivo">
                <input
                  disabled={!selectedListId}
                  value={criteriaForm.targetRole}
                  onChange={(event) => setCriteriaForm({ ...criteriaForm, targetRole: event.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-50"
                  placeholder="Gerente, operaciones, mantenimiento..."
                />
              </Field>
              <Field label="Tamaño de empresa">
                <input
                  disabled={!selectedListId}
                  value={criteriaForm.companySize}
                  onChange={(event) => setCriteriaForm({ ...criteriaForm, companySize: event.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-50"
                  placeholder="11-50, 50-200, 200+..."
                />
              </Field>
              <Field label="Dolor principal">
                <textarea
                  disabled={!selectedListId}
                  value={criteriaForm.pain}
                  onChange={(event) => setCriteriaForm({ ...criteriaForm, pain: event.target.value })}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-50"
                  placeholder="Qué problema queremos detectar o resolver"
                />
              </Field>
              <Field label="Oferta / gancho">
                <textarea
                  disabled={!selectedListId}
                  value={criteriaForm.offer}
                  onChange={(event) => setCriteriaForm({ ...criteriaForm, offer: event.target.value })}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-50"
                  placeholder="Diagnóstico, auditoría, demo, propuesta..."
                />
              </Field>
              <Field label="Excluir">
                <input
                  disabled={!selectedListId}
                  value={criteriaForm.excludedSectors}
                  onChange={(event) => setCriteriaForm({ ...criteriaForm, excludedSectors: event.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-50"
                  placeholder="Freelancers, empresas sin web, sectores no deseados..."
                />
              </Field>
              <Field label="Notas de búsqueda">
                <input
                  disabled={!selectedListId}
                  value={criteriaForm.searchNotes}
                  onChange={(event) => setCriteriaForm({ ...criteriaForm, searchNotes: event.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-50"
                  placeholder="Prioridades o señales a revisar antes de importar"
                />
              </Field>
              <div className="lg:col-span-2">
                <div className="mb-3 flex flex-wrap gap-2">
                  {criteriaReadiness.items.map((item) => (
                    <span key={item.label} className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.ready ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {item.label}
                    </span>
                  ))}
                </div>
                <button
                  disabled={!selectedListId || savingCriteria}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingCriteria ? <Loader2 className="animate-spin" size={17} /> : <Save size={17} />}
                  {savingCriteria ? 'Guardando...' : 'Guardar criterios'}
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
        </>
      )}

      {activeWorkspaceTab === 'search' && (
        <>
          <SectionHeader
            number="04"
            title="Búsqueda controlada"
            description="Revisa los filtros y autoriza Prospeo solo cuando el criterio esté limpio. Esta parte puede consumir créditos."
          />

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Search size={18} className="text-slate-500" />
                  <h3 className="font-bold text-slate-950">Buscar con Prospeo</h3>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {prospeoUsage?.configured ? `Hoy: ${prospeoUsage.searchUsed}/${prospeoUsage.searchLimit} búsquedas usadas.` : 'Prospeo todavía no está configurado en este entorno.'}
                </p>
              </div>
              <button type="button" onClick={loadProspeoUsage} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50">
                Ver límite
              </button>
            </div>

            <form onSubmit={searchProspeo} className="mt-4 grid gap-4 lg:grid-cols-2">
              <Field label="Cargos objetivo">
                <input
                  value={prospeoForm.jobTitles}
                  onChange={(event) => setProspeoForm({ ...prospeoForm, jobTitles: event.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                  placeholder="gerente, mantenimiento, operaciones"
                />
              </Field>
              <Field label="Ubicación">
                <input
                  value={prospeoForm.locations}
                  onChange={(event) => setProspeoForm({ ...prospeoForm, locations: event.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                  placeholder="Alicante, Spain"
                />
              </Field>
              <Field label="Industrias">
                <input
                  value={prospeoForm.industries}
                  onChange={(event) => setProspeoForm({ ...prospeoForm, industries: event.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                  placeholder="Construction, Facilities Services..."
                />
              </Field>
              <Field label="Empresas / palabras clave">
                <input
                  value={prospeoForm.companyKeywords}
                  onChange={(event) => setProspeoForm({ ...prospeoForm, companyKeywords: event.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                  placeholder="hotel, clínica, industria..."
                />
              </Field>
              <Field label="Máximo a importar">
                <input
                  type="number"
                  min={1}
                  max={25}
                  value={prospeoForm.maxResults}
                  onChange={(event) => setProspeoForm({ ...prospeoForm, maxResults: Number(event.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                />
              </Field>
              <label className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-semibold text-amber-900">
                <input
                  type="checkbox"
                  checked={prospeoForm.confirmSpend}
                  onChange={(event) => setProspeoForm({ ...prospeoForm, confirmSpend: event.target.checked })}
                  className="h-4 w-4"
                />
                Autorizar 1 búsqueda de Prospeo
              </label>
              <div className="lg:col-span-2">
                <button
                  disabled={!selectedListId || searchingProspeo || !prospeoUsage?.configured || !prospeoForm.confirmSpend || (prospeoUsage?.searchRemaining ?? 0) <= 0}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {searchingProspeo ? <Loader2 className="animate-spin" size={17} /> : <Search size={17} />}
                  {searchingProspeo ? 'Buscando...' : 'Buscar e importar'}
                </button>
                <p className="mt-2 text-xs text-slate-500">
                  Por ahora no revela emails ni móviles. Solo importa perfiles para revisión y evita duplicados por empresa, web o email.
                </p>
              </div>
            </form>
          </section>
        </>
      )}

      {activeWorkspaceTab === 'communication' && (
        <>
          <SectionHeader
            number="05"
            title="Comunicación y seguimiento"
            description="Desde aquí se revisa el correo conectado, respuestas, follow-ups y estado de cada prospecto."
          />

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Mail size={18} className="text-slate-500" />
                  <h3 className="font-bold text-slate-950">Email de prospección</h3>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {emailStatus?.fromAddress || 'transformaciondigital@davofrio.com'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={loadEmailStatus} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50">
                  Ver estado
                </button>
                <button
                  type="button"
                  onClick={pollEmailReplies}
                  disabled={pollingEmail || !emailStatus?.enabled || !(emailStatus?.graphConfigured || emailStatus?.imapConfigured)}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {pollingEmail ? <Loader2 className="animate-spin" size={16} /> : <Reply size={16} />}
                  Revisar respuestas
                </button>
              </div>
            </div>
            <div className="mt-4 grid gap-3 text-xs font-semibold sm:grid-cols-3">
              <span className={`rounded-lg px-3 py-2 ${emailStatus?.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                Envío {emailStatus?.enabled ? 'activo' : 'pendiente'}
              </span>
              <span className={`rounded-lg px-3 py-2 ${(emailStatus?.graphConfigured || emailStatus?.smtpConfigured) ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                {emailStatus?.provider === 'microsoft-graph'
                  ? 'Graph envío activo'
                  : `SMTP ${emailStatus?.smtpConfigured ? 'configurado' : 'sin clave'}`}
              </span>
      <span className={`rounded-lg px-3 py-2 ${(emailStatus?.graphConfigured || emailStatus?.imapConfigured) && emailStatus?.pollEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                Respuestas {(emailStatus?.graphConfigured || emailStatus?.imapConfigured) && emailStatus?.pollEnabled ? `cada ${emailStatus.pollIntervalSeconds}s` : 'pendientes'}
              </span>
            </div>
            {emailStatus?.usage && (
              <p className="mt-3 text-xs font-semibold text-slate-500">
                Enviados hoy: {emailStatus.usage.sentToday}/{emailStatus.usage.dailyLimit} · restantes {emailStatus.usage.remainingToday}
              </p>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Inbox size={18} className="text-slate-500" />
                  <h3 className="font-bold text-slate-950">Panel de campaña</h3>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedList ? selectedList.name : 'Selecciona una lista para ver el seguimiento.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => loadCampaignSummary(selectedListId)}
                disabled={!selectedListId || loadingSummary}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loadingSummary ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                Actualizar panel
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <CampaignMetric label="Emails enviados" value={selectedListMetrics.sentEmails} tone="blue" />
              <CampaignMetric label="Respuestas" value={selectedListMetrics.replies} tone="slate" />
              <CampaignMetric label="Interesados" value={selectedListMetrics.interested} tone="emerald" />
              <CampaignMetric label="Más tarde" value={selectedListMetrics.later} tone="amber" />
              <CampaignMetric label="No interesados" value={selectedListMetrics.notInterested} tone="rose" />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <CampaignMetric label="Reuniones" value={selectedListMetrics.meetings} tone="emerald" compact />
              <CampaignMetric label="Seguimientos vencidos" value={selectedListMetrics.pendingFollowUps} tone="amber" compact />
              <CampaignMetric label="Descartados" value={selectedListMetrics.discarded} tone="slate" compact />
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-bold text-slate-950">Bandeja de respuestas</h4>
                <span className="text-xs font-semibold text-slate-500">{campaignSummary?.inbox.length || 0} recientes</span>
              </div>
              <div className="mt-3 space-y-3">
                {(campaignSummary?.inbox || []).map((item) => (
                  <article key={item.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => openProspectDetail(item.prospectId)}
                        className="min-w-0 text-left"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <h5 className="font-bold text-slate-950">{item.companyName || 'Prospecto sin empresa'}</h5>
                          <ContactBadge status={item.outcome || 'RESPONDIDO'} />
                        </div>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          {[item.contactName, item.contactEmail].filter(Boolean).join(' · ') || 'Sin remitente'} · {formatDate(item.createdAt)}
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => openProspectDetail(item.prospectId)}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                      >
                        Ver prospecto
                      </button>
                    </div>
                    {item.subject && <p className="mt-3 text-sm font-semibold text-slate-700">{item.subject}</p>}
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{item.body || 'Sin texto de respuesta.'}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {[
                        ['INTERESADO', 'Interesado'],
                        ['MAS_TARDE', 'Más tarde'],
                        ['PIDIO_INFO', 'Pidió info'],
                        ['REUNION', 'Reunión'],
                        ['NO_INTERESADO', 'No interesado'],
                      ].map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => classifyInboxItem(item, value)}
                          disabled={classifyingActivityId === item.id}
                          className={`rounded-lg border px-3 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${item.outcome === value ? 'border-slate-900 bg-slate-950 text-white' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                        >
                          {classifyingActivityId === item.id ? 'Guardando...' : label}
                        </button>
                      ))}
                    </div>
                  </article>
                ))}
                {!campaignSummary?.inbox.length && (
                  <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center">
                    <Reply className="mx-auto text-slate-400" size={20} />
                    <p className="mt-3 text-sm font-semibold text-slate-700">Sin respuestas registradas en esta lista</p>
                    <p className="mt-1 text-sm text-slate-500">Cuando alguien responda un email con token de Prospección IA aparecerá aquí.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 border-t border-slate-100 pt-5">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-bold text-slate-950">Próximos seguimientos</h4>
                <span className="text-xs font-semibold text-slate-500">{campaignSummary?.followUps?.length || 0} activos</span>
              </div>
              <div className="mt-3 space-y-3">
                {(campaignSummary?.followUps || []).map((item) => (
                  <article key={item.id} className={`rounded-lg border p-4 ${item.overdue ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <button type="button" onClick={() => openProspectDetail(item.prospectId)} className="text-left">
                        <div className="flex flex-wrap items-center gap-2">
                          <h5 className="font-bold text-slate-950">{item.companyName || 'Prospecto sin empresa'}</h5>
                          <ContactBadge status={item.outcome || 'MAS_TARDE'} />
                        </div>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          {[item.contactName, item.contactEmail].filter(Boolean).join(' · ') || 'Sin contacto'} · {formatDate(item.nextFollowUpAt)}
                        </p>
                      </button>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.overdue ? 'bg-amber-200 text-amber-900' : 'bg-slate-100 text-slate-600'}`}>
                        {item.overdue ? 'Vencido' : 'Programado'}
                      </span>
                    </div>
                    {item.note && <p className="mt-2 text-sm text-slate-600">{item.note}</p>}
                  </article>
                ))}
                {!campaignSummary?.followUps?.length && (
                  <div className="rounded-lg border border-dashed border-slate-300 p-5 text-center">
                    <p className="text-sm font-semibold text-slate-700">Sin seguimientos pendientes</p>
                    <p className="mt-1 text-sm text-slate-500">Cuando marques una respuesta como “Más tarde” aparecerá aquí.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 border-t border-slate-100 pt-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-950">Secuencia de emails</h4>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    Follow-up sugerido después de {sequenceSummary.delayDays} días sin respuesta.
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                  {sequenceSummary.actions.length} acciones
                </span>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
                <CampaignMetric label="Sin email" value={sequenceSummary.metrics.missingEmail} tone="rose" compact />
                <CampaignMetric label="Paso 1" value={sequenceSummary.metrics.pendingFirstEmail} tone="blue" compact />
                <CampaignMetric label="Esperando" value={sequenceSummary.metrics.waitingReply} tone="slate" compact />
                <CampaignMetric label="Follow-up" value={sequenceSummary.metrics.readyFollowUp} tone="amber" compact />
                <CampaignMetric label="Respondidos" value={sequenceSummary.metrics.responded} tone="emerald" compact />
                <CampaignMetric label="Detenidos" value={sequenceSummary.metrics.stopped} tone="rose" compact />
              </div>
              <div className="mt-3 space-y-3">
                {sequenceSummary.actions.slice(0, 8).map((item) => (
                  <article key={`${item.prospectId}-${item.type}-${item.nextMessageId || item.lastSentAt || item.lastActivityAt || 'action'}`} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <button type="button" onClick={() => openProspectDetail(item.prospectId)} className="min-w-0 text-left">
                        <div className="flex flex-wrap items-center gap-2">
                          <h5 className="font-bold text-slate-950">{item.companyName || 'Prospecto sin empresa'}</h5>
                          <SequenceBadge type={item.type} label={item.label} />
                        </div>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          {[item.contactName, item.contactEmail].filter(Boolean).join(' · ') || 'Sin contacto'}
                        </p>
                      </button>
                      <div className="flex flex-wrap gap-2">
                        {item.nextMessageId && (item.type === 'PENDING_FIRST_EMAIL' || item.type === 'READY_FOLLOW_UP') && (
                          <button
                            type="button"
                            onClick={() => prepareSequenceAction(item)}
                            className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50"
                          >
                            Preparar envío
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => prepareSequenceAction(item)}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                        >
                          Revisar
                        </button>
                      </div>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.detail}</p>
                    {item.nextMessageSubject && (
                      <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                        Siguiente asunto: {item.nextMessageSubject}
                      </p>
                    )}
                  </article>
                ))}
                {!sequenceSummary.actions.length && (
                  <div className="rounded-lg border border-dashed border-slate-300 p-5 text-center">
                    <p className="text-sm font-semibold text-slate-700">Sin acciones de secuencia</p>
                    <p className="mt-1 text-sm text-slate-500">Cuando haya prospectos con mensajes o emails enviados aparecerán aquí.</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        </>
      )}

      {activeWorkspaceTab === 'prospects' && (
        <>
          <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-950">Prospectos</h3>
                {selectedList && <p className="mt-1 text-xs text-slate-500">{selectedList.name}</p>}
              </div>
                <div className="flex items-center gap-2">
                  {loadingProspects && <Loader2 className="animate-spin text-slate-400" size={18} />}
                  <button
                    onClick={archiveSelectedList}
                    disabled={!selectedListId || archivingListId === selectedListId || deletingListId === selectedListId}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {archivingListId === selectedListId ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                    Archivar
                  </button>
                  <button
                    onClick={deleteSelectedList}
                    disabled={!selectedListId || deletingListId === selectedListId || archivingListId === selectedListId}
                    className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deletingListId === selectedListId ? <Loader2 className="animate-spin" size={16} /> : <XCircle size={16} />}
                    Eliminar
                  </button>
                  <button
                    onClick={generatePendingProspects}
                    disabled={!selectedListId || bulkGenerating || !prospects.length}
                    className="inline-flex items-center gap-2 rounded-lg border border-violet-200 px-3 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {bulkGenerating ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                    Investigar lista
                  </button>
                </div>
            </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  ['TODOS', 'Todos'],
                  ['NUEVO', 'Nuevos'],
                  ['MENSAJE_GENERADO', 'Generados'],
                  ['APROBADO', 'Aprobados'],
                  ['CONTACTADO', 'Contactados'],
                  ['DESCARTADO', 'Descartados'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => toggleProspectFilter(value)}
                    className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${prospectFilter === value ? 'border-slate-900 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                  >
                    {label} {filterCounts[value as keyof typeof filterCounts] || 0}
                  </button>
                ))}
              </div>
              <div className="mt-4 space-y-3">
                {filteredProspects.map((prospect) => (
                  <article
                    key={prospect.id}
                    className={`rounded-lg border p-4 transition ${visibleProspect?.id === prospect.id ? 'border-blue-300 bg-blue-50/50' : 'border-slate-200 bg-white'}`}
                  >
                    <button onClick={() => setSelectedProspectId(prospect.id)} className="block w-full text-left">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="font-bold text-slate-950">{prospect.company_name}</h4>
                          <p className="mt-1 text-sm text-slate-500">{[prospect.contact_name, prospect.contact_role].filter(Boolean).join(' · ') || 'Sin contacto asignado'}</p>
                        </div>
                        <StatusBadge status={prospect.status} />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <ContactBadge status={deriveContactState(prospect).status} />
                        {prospect.priority && <span className="rounded-full bg-slate-100 px-2.5 py-1 font-bold text-slate-700">{prospect.priority}</span>}
                        {typeof prospect.fit_score === 'number' && <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-bold text-emerald-700">Score {prospect.fit_score}</span>}
                        {prospect.sector && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{prospect.sector}</span>}
                      </div>
                    </button>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button onClick={() => generateProspect(prospect.id)} disabled={generatingId === prospect.id} className="inline-flex items-center gap-2 rounded-lg border border-violet-200 px-3 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-50">
                        {generatingId === prospect.id ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                        Generar IA
                      </button>
                      <button onClick={() => updateProspectStatus(prospect.id, 'APROBADO')} className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">
                        <CheckCircle2 size={16} />
                        Aprobar
                      </button>
                      <button onClick={() => updateProspectStatus(prospect.id, 'DESCARTADO')} className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50">
                        <XCircle size={16} />
                        Descartar
                      </button>
                    </div>
                  </article>
                ))}
                {!loadingProspects && !prospects.length && (
                  <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center">
                    <Search className="mx-auto text-slate-400" />
                    <p className="mt-3 text-sm font-semibold text-slate-700">Todavia no hay prospectos</p>
                    <p className="mt-1 text-sm text-slate-500">Importa una lista para generar investigacion y mensajes.</p>
                  </div>
                )}
                {!loadingProspects && prospects.length > 0 && !filteredProspects.length && (
                  <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center">
                    <Search className="mx-auto text-slate-400" />
                    <p className="mt-3 text-sm font-semibold text-slate-700">No hay prospectos en este filtro</p>
                  </div>
                )}
              </div>
            </div>

            <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <MessageSquareText size={18} className="text-slate-500" />
                <h3 className="font-bold text-slate-950">Investigacion, mensajes y seguimiento</h3>
              </div>
              {visibleProspect ? (
                <div className="mt-5 space-y-5">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Empresa</p>
                    <h4 className="mt-1 text-lg font-bold text-slate-950">{visibleProspect.company_name}</h4>
                    <p className="mt-1 text-sm text-slate-500">{visibleProspect.website || visibleProspect.email || 'Sin datos de contacto adicionales'}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <ContactBadge status={visibleContactState.status} />
                      {visibleContactState.channel && <span className="rounded-full bg-slate-100 px-2.5 py-1 font-bold text-slate-600">{visibleContactState.channel}</span>}
                      {visibleContactState.nextFollowUpAt && <span className="rounded-full bg-amber-100 px-2.5 py-1 font-bold text-amber-700">Seguimiento {formatDate(visibleContactState.nextFollowUpAt)}</span>}
                    </div>
                  </div>

                  {visibleProspect.prospect_research ? (
                    <div className="space-y-4">
                      <InfoBlock title="Resumen" text={visibleProspect.prospect_research.company_summary} />
                      <InfoBlock title="Hipotesis de dolor" text={visibleProspect.prospect_research.pain_hypothesis} />
                      <InfoBlock title="Senal comercial" text={visibleProspect.prospect_research.buying_signal} />
                      <InfoBlock title="Angulo" text={visibleProspect.prospect_research.personalization_angle} />
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-300 p-5 text-sm text-slate-500">
                      Genera la investigacion IA para ver contexto, angulo de entrada y mensajes.
                    </div>
                  )}

                  <div className="space-y-3">
                    {(visibleProspect.prospect_messages || []).map((item) => (
                      <article key={item.id} className={`rounded-lg border p-4 ${highlightMessageId === item.id ? 'border-blue-300 bg-blue-50/50 ring-2 ring-blue-100' : 'border-slate-200'}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-500">{item.channel} · Paso {item.step}</span>
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">{item.status}</span>
                        </div>
                        {item.channel === 'EMAIL' && (
                          <input
                            value={messageDrafts[item.id]?.subject || ''}
                            onChange={(event) => updateMessageDraft(item.id, 'subject', event.target.value)}
                            className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-950 outline-none focus:border-slate-500"
                            placeholder="Asunto"
                          />
                        )}
                        <textarea
                          value={messageDrafts[item.id]?.body || ''}
                          onChange={(event) => updateMessageDraft(item.id, 'body', event.target.value)}
                          rows={item.channel === 'LINKEDIN' ? 4 : 8}
                          className="mt-3 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm leading-6 text-slate-700 outline-none focus:border-slate-500"
                        />
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            onClick={() => copyMessage(item)}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <Copy size={16} />
                            Copiar
                          </button>
                          <button
                            onClick={() => saveProspectMessage(item.id)}
                            disabled={savingMessageId === item.id}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            {savingMessageId === item.id ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                            Guardar
                          </button>
                          {item.channel === 'EMAIL' && (
                            <button
                              onClick={() => sendEmailMessage(item)}
                              disabled={sendingEmailId === item.id || !emailStatus?.enabled || !(emailStatus?.graphConfigured || emailStatus?.smtpConfigured)}
                              className="inline-flex items-center gap-2 rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {sendingEmailId === item.id ? <Loader2 className="animate-spin" size={16} /> : <Mail size={16} />}
                              Enviar email
                            </button>
                          )}
                          <button
                            onClick={() => saveProspectMessage(item.id, 'APROBADO')}
                            disabled={savingMessageId === item.id}
                            className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                          >
                            <CheckCircle2 size={16} />
                            Aprobar mensaje
                          </button>
                          <button
                            onClick={() => saveProspectMessage(item.id, 'DESCARTADO')}
                            disabled={savingMessageId === item.id}
                            className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                          >
                            <XCircle size={16} />
                            Descartar
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>

                  <section className="rounded-lg border border-slate-200 p-4">
                    <div className="flex items-center gap-2">
                      <Mail size={16} className="text-slate-500" />
                      <h4 className="font-bold text-slate-950">Registrar contacto</h4>
                    </div>
                    <form onSubmit={saveOutreach} className="mt-4 space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Contacto">
                          <input
                            value={outreachForm.contactName}
                            onChange={(event) => setOutreachForm({ ...outreachForm, contactName: event.target.value })}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                            placeholder="Nombre del contacto"
                          />
                        </Field>
                        <Field label="Email contacto">
                          <input
                            type="email"
                            value={outreachForm.contactEmail}
                            onChange={(event) => setOutreachForm({ ...outreachForm, contactEmail: event.target.value })}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                            placeholder="correo@empresa.com"
                          />
                        </Field>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Canal">
                          <select
                            value={outreachForm.channel}
                            onChange={(event) => setOutreachForm({ ...outreachForm, channel: event.target.value })}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                          >
                            <option value="EMAIL">Email</option>
                            <option value="WHATSAPP">WhatsApp</option>
                            <option value="LINKEDIN">LinkedIn</option>
                            <option value="LLAMADA">Llamada</option>
                          </select>
                        </Field>
                        <Field label="Estado">
                          <select
                            value={outreachForm.outreachStatus}
                            onChange={(event) => setOutreachForm({ ...outreachForm, outreachStatus: event.target.value })}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                          >
                            <option value="CONTACTADO">Contactado</option>
                            <option value="INTERESADO">Interesado</option>
                            <option value="MAS_TARDE">Más tarde</option>
                            <option value="OBJECION">Objeción</option>
                            <option value="PIDIO_INFO">Pidió info</option>
                            <option value="REUNION">Reunión</option>
                            <option value="NO_INTERESADO">No interesado</option>
                            <option value="NO_CONTACTAR">No contactar</option>
                          </select>
                        </Field>
                      </div>
                      {outreachForm.channel === 'EMAIL' && (
                        <Field label="Asunto">
                          <input
                            value={outreachForm.subject}
                            onChange={(event) => setOutreachForm({ ...outreachForm, subject: event.target.value })}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                            placeholder="Asunto del email"
                          />
                        </Field>
                      )}
                      <Field label="Mensaje">
                        <textarea
                          value={outreachForm.body}
                          onChange={(event) => setOutreachForm({ ...outreachForm, body: event.target.value })}
                          rows={6}
                          className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2.5 text-sm leading-6"
                          placeholder="Mensaje enviado o por enviar"
                        />
                      </Field>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Próximo seguimiento">
                          <input
                            type="datetime-local"
                            value={outreachForm.nextFollowUpAt}
                            onChange={(event) => setOutreachForm({ ...outreachForm, nextFollowUpAt: event.target.value })}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                          />
                        </Field>
                        <Field label="Nota interna">
                          <input
                            value={outreachForm.notes}
                            onChange={(event) => setOutreachForm({ ...outreachForm, notes: event.target.value })}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                            placeholder="Contexto rápido"
                          />
                        </Field>
                      </div>
                      <button
                        disabled={savingOutreach}
                        className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                      >
                        {savingOutreach ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                        Guardar seguimiento
                      </button>
                    </form>
                  </section>

                  <section className="rounded-lg border border-slate-200 p-4">
                    <div className="flex items-center gap-2">
                      <Reply size={16} className="text-slate-500" />
                      <h4 className="font-bold text-slate-950">Registrar respuesta</h4>
                    </div>
                    <form onSubmit={saveResponse} className="mt-4 space-y-3">
                      <Field label="Clasificación">
                        <select
                          value={responseForm.classification}
                          onChange={(event) => setResponseForm({ ...responseForm, classification: event.target.value })}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                        >
                          <option value="INTERESADO">Interesado</option>
                          <option value="MAS_TARDE">Más tarde</option>
                          <option value="OBJECION">Objeción</option>
                          <option value="PIDIO_INFO">Pidió info</option>
                          <option value="REUNION">Reunión</option>
                          <option value="NO_INTERESADO">No interesado</option>
                          <option value="NO_CONTACTAR">No contactar</option>
                        </select>
                      </Field>
                      <Field label="Respuesta del prospecto">
                        <textarea
                          value={responseForm.responseText}
                          onChange={(event) => setResponseForm({ ...responseForm, responseText: event.target.value })}
                          rows={4}
                          className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2.5 text-sm leading-6"
                          placeholder="Pega aquí la respuesta o resumen"
                        />
                      </Field>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Próximo seguimiento">
                          <input
                            type="datetime-local"
                            value={responseForm.nextFollowUpAt}
                            onChange={(event) => setResponseForm({ ...responseForm, nextFollowUpAt: event.target.value })}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                          />
                        </Field>
                        <Field label="Nota interna">
                          <input
                            value={responseForm.notes}
                            onChange={(event) => setResponseForm({ ...responseForm, notes: event.target.value })}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                            placeholder="Qué hacer después"
                          />
                        </Field>
                      </div>
                      <button
                        disabled={savingResponse}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        {savingResponse ? <Loader2 className="animate-spin" size={16} /> : <Reply size={16} />}
                        Guardar respuesta
                      </button>
                    </form>
                  </section>

                  <section className="rounded-lg border border-slate-200 p-4">
                    <h4 className="font-bold text-slate-950">Historial</h4>
                    <div className="mt-4 space-y-3">
                      {(visibleProspect.prospect_activities || []).slice(0, 8).map((activity) => (
                        <div key={activity.id} className="border-l-2 border-slate-200 pl-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-slate-500">{activity.type}</span>
                            <span className="text-xs text-slate-400">{formatDate(activity.created_at)}</span>
                          </div>
                          <p className="mt-1 text-sm text-slate-700">{activity.description}</p>
                          {typeof activity.metadata?.notes === 'string' && activity.metadata.notes && (
                            <p className="mt-1 text-xs text-slate-500">{activity.metadata.notes}</p>
                          )}
                        </div>
                      ))}
                      {!(visibleProspect.prospect_activities || []).length && (
                        <p className="text-sm text-slate-500">Sin eventos de seguimiento todavía.</p>
                      )}
                    </div>
                  </section>
                </div>
              ) : (
                <p className="mt-5 text-sm text-slate-500">Selecciona un prospecto para revisar el detalle.</p>
              )}
            </aside>
          </section>
        </>
      )}
      </main>
    </div>
  );
}

function parseCsvLike(value: string) {
  const lines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return [];
  const [first, ...rest] = lines;
  const firstCells = splitCsvLine(first);
  const hasHeader = firstCells.some((cell) => /empresa|company/i.test(cell));
  const rows = hasHeader ? rest : lines;
  const headerMap = hasHeader
    ? firstCells.reduce<Record<string, number>>((map, cell, index) => {
      map[normalizeHeader(cell)] = index;
      return map;
    }, {})
    : {};

  const getCell = (cells: string[], names: string[], fallbackIndex: number) => {
    for (const name of names) {
      const index = headerMap[name];
      if (typeof index === 'number') return cells[index] || '';
    }
    return cells[fallbackIndex] || '';
  };

  return rows.map((line) => {
    const cells = splitCsvLine(line);
    return {
      companyName: getCell(cells, ['empresa', 'company', 'companyname', 'company_name', 'nombreempresa'], 0),
      website: getCell(cells, ['web', 'website', 'url', 'sitio'], 1),
      contactName: getCell(cells, ['contacto', 'contact', 'contactname', 'contact_name', 'nombre'], 2),
      contactRole: getCell(cells, ['cargo', 'role', 'contactrole', 'contact_role', 'puesto'], 3),
      email: getCell(cells, ['email', 'correo', 'mail'], 4),
      sector: getCell(cells, ['sector', 'industry', 'industria'], 5),
      city: getCell(cells, ['ciudad', 'city'], 6),
      country: getCell(cells, ['pais', 'country'], 7),
      companySize: getCell(cells, ['tamano', 'tamaño', 'size', 'companysize', 'company_size'], 8),
    };
  }).filter((row) => row.companyName);
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}

function readIcpString(icp: Record<string, string> | null | undefined, key: string) {
  const value = icp?.[key];
  return typeof value === 'string' ? value : '';
}

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]/g, '');
}

function deriveContactState(prospect?: Prospect | null) {
  const activities = prospect?.prospect_activities || [];
  const latestTracked = activities.find((activity) => typeof activity.metadata?.outreachStatus === 'string');
  if (latestTracked) {
    return {
      status: String(latestTracked.metadata.outreachStatus),
      channel: typeof latestTracked.metadata.channel === 'string' ? latestTracked.metadata.channel : '',
      nextFollowUpAt: typeof latestTracked.metadata.nextFollowUpAt === 'string' ? latestTracked.metadata.nextFollowUpAt : '',
    };
  }

  const messages = prospect?.prospect_messages || [];
  if (messages.some((item) => item.status === 'RESPONDIDO')) return { status: 'RESPONDIDO', channel: '', nextFollowUpAt: '' };
  if (messages.some((item) => item.status === 'ENVIADO')) return { status: 'CONTACTADO', channel: '', nextFollowUpAt: '' };
  return { status: 'SIN_CONTACTAR', channel: '', nextFollowUpAt: '' };
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function futureDateTimeLocal(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(9, 0, 0, 0);
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <span className="text-slate-500">{icon}</span>
      <p className="mt-3 text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-950">{value.toLocaleString('es-ES')}</p>
    </article>
  );
}

function CampaignMetric({ label, value, tone, compact = false }: { label: string; value: number; tone: 'slate' | 'blue' | 'emerald' | 'amber' | 'rose'; compact?: boolean }) {
  const classes = {
    slate: 'border-slate-200 bg-slate-50 text-slate-800',
    blue: 'border-blue-100 bg-blue-50 text-blue-800',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-800',
    amber: 'border-amber-100 bg-amber-50 text-amber-800',
    rose: 'border-rose-100 bg-rose-50 text-rose-800',
  }[tone];

  return (
    <div className={`rounded-lg border px-4 ${compact ? 'py-3' : 'py-4'} ${classes}`}>
      <p className="text-xs font-bold uppercase text-current opacity-70">{label}</p>
      <p className={`${compact ? 'mt-1 text-xl' : 'mt-2 text-2xl'} font-bold`}>{value.toLocaleString('es-ES')}</p>
    </div>
  );
}

function SectionHeader({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{number}</p>
        <h2 className="mt-1 text-xl font-bold text-slate-950">{title}</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">{description}</p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function StatusBadge({ status }: { status: string }) {
  const classes = status === 'APROBADO'
    ? 'bg-emerald-100 text-emerald-700'
    : status === 'DESCARTADO'
      ? 'bg-rose-100 text-rose-700'
      : status === 'MENSAJE_GENERADO' || status === 'INVESTIGADO'
        ? 'bg-violet-100 text-violet-700'
        : 'bg-slate-100 text-slate-600';

  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${classes}`}>{status}</span>;
}

function ContactBadge({ status }: { status: string }) {
  const label = status.replace(/_/g, ' ');
  const classes = status === 'SIN_CONTACTAR'
    ? 'bg-slate-100 text-slate-500'
    : status === 'NO_INTERESADO' || status === 'NO_CONTACTAR'
      ? 'bg-rose-100 text-rose-700'
      : status === 'MAS_TARDE' || status === 'OBJECION'
        ? 'bg-amber-100 text-amber-700'
        : 'bg-blue-100 text-blue-700';

  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${classes}`}>{label}</span>;
}

function LinkedinStatusBadge({ status }: { status: LinkedinIdea['status'] }) {
  const labels = {
    pendiente: 'Pendiente',
    aprobada: 'Aprobada',
    rechazada: 'Rechazada',
    programada: 'Programada',
    publicada: 'Publicada',
  };
  const classes = status === 'aprobada' || status === 'publicada'
    ? 'bg-emerald-100 text-emerald-700'
    : status === 'programada'
      ? 'bg-amber-100 text-amber-700'
      : status === 'rechazada'
        ? 'bg-rose-100 text-rose-700'
        : 'bg-blue-100 text-blue-700';

  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${classes}`}>{labels[status] || status}</span>;
}

function SequenceBadge({ type, label }: { type: string; label: string }) {
  const classes = type === 'READY_FOLLOW_UP'
    ? 'bg-amber-100 text-amber-700'
    : type === 'RESPONDED'
      ? 'bg-emerald-100 text-emerald-700'
      : type === 'STOPPED' || type === 'MISSING_EMAIL'
        ? 'bg-rose-100 text-rose-700'
        : type === 'PENDING_FIRST_EMAIL'
          ? 'bg-blue-100 text-blue-700'
          : 'bg-slate-100 text-slate-600';

  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${classes}`}>{label}</span>;
}

function InfoBlock({ title, text }: { title: string; text?: string | null }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-600">{text || 'Sin informacion.'}</p>
    </div>
  );
}
