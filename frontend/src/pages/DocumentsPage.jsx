import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import PageHeaderWithBack from "../components/PageHeaderWithBack";
import API from "../api";
import { getProjects } from "../utils/projects";
import { getTokenSession } from "../utils/auth";

const TEST_AREAS = [
  "ICT_Mobo",
  "BSI_Mobo",
  "FBT_Mobo",
  "ICT_Agora",
  "FBT_Agora",
  "TOOLS",
  "ORT",
  "L10_Racks",
];

const DOC_TYPES = [
  { value: "all", label: "All Types" },
  { value: "pdf", label: "PDF" },
  { value: "xls", label: "Excel (.xls)" },
  { value: "xlsx", label: "Excel (.xlsx)" },
  { value: "csv", label: "CSV" },
  { value: "ppt", label: "PowerPoint (.ppt)" },
  { value: "pptx", label: "PowerPoint (.pptx)" },
  { value: "doc", label: "Word (.doc)" },
  { value: "docx", label: "Word (.docx)" },
  { value: "txt", label: "Text (.txt)" },
];

const getFileIcon = (type = "") => {
  const lower = type.toLowerCase();
  if (["xls", "xlsx", "csv"].includes(lower)) return "📊";
  if (["ppt", "pptx"].includes(lower)) return "📽️";
  if (["doc", "docx", "txt"].includes(lower)) return "📝";
  if (["png", "jpg", "jpeg"].includes(lower)) return "🖼️";
  return "📄";
};

const formatFileSize = (bytes = 0) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function DocumentsPage() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [selectedProject, setSelectedProject] = useState("");
  const [selectedTestArea, setSelectedTestArea] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [search, setSearch] = useState("");
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);

  const [projects, setProjects] = useState(getProjects());
  const [isAdmin, setIsAdmin] = useState(() => getTokenSession()?.role === "admin");
  const [sessionValid, setSessionValid] = useState(() => !!getTokenSession());

  const [showUploadPanel, setShowUploadPanel] = useState(() => getTokenSession()?.role === "admin");
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadScope, setUploadScope] = useState("project");
  const [uploadProject, setUploadProject] = useState("");
  const [uploadTestArea, setUploadTestArea] = useState("");
  const [uploadRemarks, setUploadRemarks] = useState("");
  const fileInputRef = useRef(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewType, setPreviewType] = useState("");
  const [previewTitle, setPreviewTitle] = useState("");

  const canManage = isAdmin && sessionValid;

  const mergedProjects = useMemo(() => {
    const fromDocs = documents.map((doc) => doc.project_name).filter(Boolean);
    return [...new Set([...projects, ...fromDocs])].sort();
  }, [projects, documents]);

  const visibleDocuments = useMemo(() => {
    if (!showPinnedOnly) return documents;
    return documents.filter((doc) => doc.is_pinned);
  }, [documents, showPinnedOnly]);

  const sectionedDocuments = useMemo(() => {
    const common = [];
    const byProject = {};
    visibleDocuments.forEach((doc) => {
      if ((doc.document_scope || "project") === "common") {
        common.push(doc);
        return;
      }
      const key = doc.project_name || "Unassigned";
      if (!byProject[key]) byProject[key] = [];
      byProject[key].push(doc);
    });

    const projectsList = Object.keys(byProject)
      .sort((a, b) => a.localeCompare(b))
      .map((projectName) => ({ projectName, documents: byProject[projectName] }));

    return { common, projectsList };
  }, [visibleDocuments]);

  useEffect(() => {
    const session = getTokenSession();
    if (!session) {
      setSessionValid(false);
      setIsAdmin(false);
      setShowUploadPanel(false);
      return;
    }

    setSessionValid(true);
    const admin = session.role === "admin";
    setIsAdmin(admin);
    if (admin) setShowUploadPanel(true);

    API.get("/auth/me")
      .then((res) => {
        setSessionValid(true);
        const serverAdmin = (res.data.role || "").toLowerCase() === "admin";
        setIsAdmin(serverAdmin);
        if (serverAdmin) setShowUploadPanel(true);
      })
      .catch((err) => {
        // Keep UI based on JWT when /auth/me unavailable or mismatched deploy
        setSessionValid(true);
        setIsAdmin(session.role === "admin");
        if (session.role === "admin") setShowUploadPanel(true);
        const status = err?.response?.status;
        if (status === 401 && session.role === "admin") {
          setError(
            "Server could not verify your session. Try logging out and back in, then upload again."
          );
        }
      });
  }, []);

  useEffect(() => {
    const handleProjectsUpdate = () => setProjects(getProjects());
    window.addEventListener("projectsUpdated", handleProjectsUpdate);
    window.addEventListener("storage", handleProjectsUpdate);
    return () => {
      window.removeEventListener("projectsUpdated", handleProjectsUpdate);
      window.removeEventListener("storage", handleProjectsUpdate);
    };
  }, []);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (selectedProject) params.project = selectedProject;
      if (selectedTestArea) params.test_area = selectedTestArea;
      if (selectedType && selectedType !== "all") params.doc_type = selectedType;
      if (search.trim()) params.search = search.trim();

      const res = await API.get("/documents/", { params });
      setDocuments(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to load documents:", err);
      setError(err?.response?.data?.detail || "Failed to load documents.");
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [selectedProject, selectedTestArea, selectedType, search]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadDocuments();
    }, 250);
    return () => clearTimeout(timeout);
  }, [loadDocuments]);

  const resetUploadForm = () => {
    setSelectedFile(null);
    setIsDragOver(false);
    setUploadScope("project");
    setUploadProject("");
    setUploadTestArea("");
    setUploadRemarks("");
  };

  const isPreviewSupported = (fileType = "") => {
    const lower = fileType.toLowerCase();
    return ["pdf", "png", "jpg", "jpeg"].includes(lower);
  };

  const handleFileSelect = (file) => {
    if (!file) return;
    setSelectedFile(file);
    setError("");
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!selectedFile) {
      setError("Please choose a file to upload.");
      return;
    }
    if (uploadScope === "project" && !uploadProject.trim()) {
      setError("Please select a project for project documents.");
      return;
    }

    setUploading(true);
    setError("");
    setSuccess("");
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("document_scope", uploadScope);
      if (uploadScope === "project") {
        formData.append("project_name", uploadProject);
      }
      if (uploadScope === "project" && uploadTestArea) formData.append("test_area", uploadTestArea);
      if (uploadRemarks.trim()) formData.append("remarks", uploadRemarks.trim());

      await API.post("/documents/upload", formData);
      setSuccess("Document uploaded successfully.");
      resetUploadForm();
      setShowUploadPanel(false);
      loadDocuments();
    } catch (err) {
      console.error("Upload failed:", err);
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      if (status === 401) {
        setError("Your session expired. Please log out and sign in again, then retry the upload.");
      } else if (status === 403) {
        setError("Only admin users can upload documents.");
      } else {
        setError(detail || "Upload failed.");
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc) => {
    try {
      const res = await API.get(`/documents/${doc.document_id}/download`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], {
        type: res.headers["content-type"] || "application/octet-stream",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.original_filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
      setError("Download failed. Please try again.");
    }
  };

  const closePreview = () => {
    if (previewUrl) {
      window.URL.revokeObjectURL(previewUrl);
    }
    setPreviewOpen(false);
    setPreviewLoading(false);
    setPreviewUrl("");
    setPreviewType("");
    setPreviewTitle("");
  };

  const handlePreview = async (doc) => {
    const lowerType = (doc.file_type || "").toLowerCase();
    if (!isPreviewSupported(lowerType)) {
      setError("Preview is available only for PDF and image files.");
      return;
    }

    setError("");
    setPreviewLoading(true);
    setPreviewOpen(true);
    setPreviewTitle(doc.original_filename);
    setPreviewType(["png", "jpg", "jpeg"].includes(lowerType) ? "image" : "pdf");

    try {
      const res = await API.get(`/documents/${doc.document_id}/download`, {
        responseType: "blob",
      });
      if (previewUrl) {
        window.URL.revokeObjectURL(previewUrl);
      }
      const blobUrl = window.URL.createObjectURL(res.data);
      setPreviewUrl(blobUrl);
    } catch (err) {
      console.error("Preview failed:", err);
      setError("Unable to preview this file.");
      closePreview();
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (previewUrl) {
        window.URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleDelete = async (doc) => {
    const confirmed = window.confirm(
      `Delete "${doc.original_filename}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    setError("");
    setSuccess("");
    try {
      await API.delete(`/documents/${doc.document_id}`);
      setSuccess("Document deleted successfully.");
      loadDocuments();
    } catch (err) {
      console.error("Delete failed:", err);
      setError(err?.response?.data?.detail || "Delete failed.");
    }
  };

  const handleTogglePin = async (doc) => {
    setError("");
    setSuccess("");
    try {
      await API.put(`/documents/${doc.document_id}/pin`, {
        is_pinned: !doc.is_pinned,
      });
      setSuccess(doc.is_pinned ? "Document unpinned." : "Document pinned to top.");
      loadDocuments();
    } catch (err) {
      console.error("Pin update failed:", err);
      setError(err?.response?.data?.detail || "Failed to update pin status.");
    }
  };

  return (
    <div className="min-h-screen bg-transparent transition-colors">
      <Header />

      <PageHeaderWithBack title="Project Documents" onBack={() => navigate("/dashboard")} />

      <p className="text-center text-sm text-gray-600 dark:text-gray-400 mb-8 -mt-4">
        Search and manage project-wise documents in one place
      </p>

      <div className="max-w-[96rem] mx-auto px-6 pb-10">
        {(error || success) && (
          <div
            className={`mb-4 rounded-lg px-4 py-3 border text-sm ${
              error
                ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-700/30"
                : "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-700/30"
            }`}
          >
            {error || success}
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5 mb-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Project
              </label>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
              >
                <option value="">All Projects</option>
                {mergedProjects.map((project) => (
                  <option key={project} value={project}>
                    {project}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Test Area
              </label>
              <select
                value={selectedTestArea}
                onChange={(e) => setSelectedTestArea(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
              >
                <option value="">All Test Areas</option>
                {TEST_AREAS.map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Type
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
              >
                {DOC_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Quick Actions
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowPinnedOnly((prev) => !prev)}
                  className={`whitespace-nowrap px-4 py-2 rounded-lg font-semibold shadow ${
                    showPinnedOnly
                      ? "bg-amber-500 hover:bg-amber-600 text-white"
                      : "bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-100"
                  }`}
                  title="Toggle pinned documents only"
                >
                  {showPinnedOnly ? "⭐ Pinned Only" : "☆ Show Pinned"}
                </button>
                {canManage && (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowUploadPanel((prev) => !prev)}
                      className="whitespace-nowrap px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow"
                      title="Show or hide upload form"
                    >
                      {showUploadPanel ? "Hide Upload" : "⬆ Upload"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Search Documents
            </label>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by file name, project, test area, or uploader..."
              className="w-full px-4 py-3 text-base bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg"
            />
          </div>
          {canManage && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-3">
              🛡️ Admin mode: Upload, pin, and delete actions are enabled. Drag and drop files in the upload area below.
            </p>
          )}
          {!sessionValid && (
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-3">
              Please sign in to upload or manage documents.
            </p>
          )}
        </div>

        {canManage && showUploadPanel && (
          <form
            onSubmit={handleUpload}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5 mb-5 border border-blue-100 dark:border-gray-700"
          >
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
              Upload New Document
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  File
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.xls,.xlsx,.csv,.ppt,.pptx,.doc,.docx,.txt,.png,.jpg,.jpeg"
                  onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    handleFileSelect(e.dataTransfer.files?.[0] || null);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${
                    isDragOver
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      : "border-gray-300 dark:border-gray-600 hover:border-blue-400"
                  }`}
                >
                  <p className="text-gray-700 dark:text-gray-200 font-semibold">
                    Drag and drop a file here
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    or click to browse from your computer
                  </p>
                  {selectedFile && (
                    <div className="mt-3 text-sm text-green-700 dark:text-green-400 font-medium">
                      Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Allowed: PDF, Excel, PPT, Word, CSV, TXT, PNG, JPG (max 10MB)
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Document Scope
                </label>
                <select
                  value={uploadScope}
                  onChange={(e) => setUploadScope(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                >
                  <option value="project">Project Document</option>
                  <option value="common">Common Department Document</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Project
                </label>
                <select
                  value={uploadProject}
                  onChange={(e) => setUploadProject(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                  required={uploadScope === "project"}
                  disabled={uploadScope === "common"}
                >
                  <option value="">
                    {uploadScope === "project" ? "Select Project" : "Not required for common docs"}
                  </option>
                  {mergedProjects.map((project) => (
                    <option key={project} value={project}>
                      {project}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Test Area (Optional)
                </label>
                <select
                  value={uploadTestArea}
                  onChange={(e) => setUploadTestArea(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                  disabled={uploadScope === "common"}
                >
                  <option value="">None</option>
                  {TEST_AREAS.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Remarks (Optional)
                </label>
                <textarea
                  value={uploadRemarks}
                  onChange={(e) => setUploadRemarks(e.target.value)}
                  placeholder="Short description, revision notes, etc."
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 min-h-[90px]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <button
                type="button"
                onClick={() => {
                  setShowUploadPanel(false);
                  resetUploadForm();
                }}
                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={uploading}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-60"
              >
                {uploading ? "Uploading..." : "Upload Document"}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg text-center py-10 text-gray-500 dark:text-gray-400">
            Loading documents...
          </div>
        ) : visibleDocuments.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg text-center py-10">
            <div className="text-4xl mb-2">📁</div>
            <p className="text-gray-600 dark:text-gray-300 font-medium">No documents found</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Try changing filters{canManage ? " or upload a document using the form above." : "."}
            </p>
            {canManage && !showUploadPanel && (
              <button
                type="button"
                onClick={() => setShowUploadPanel(true)}
                className="mt-4 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              >
                Open upload area
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
              <div className="bg-blue-100 dark:bg-blue-900/30 px-5 py-3 border-b border-blue-200 dark:border-blue-800 flex justify-between">
                <h2 className="text-lg font-semibold text-blue-800 dark:text-blue-200">Common Documents</h2>
                <span className="text-sm text-blue-700 dark:text-blue-300">{sectionedDocuments.common.length} file{sectionedDocuments.common.length === 1 ? "" : "s"}</span>
              </div>
              {sectionedDocuments.common.length === 0 ? (
                <div className="px-5 py-5 text-sm text-gray-500 dark:text-gray-400">No common documents.</div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {sectionedDocuments.common.map((doc) => {
                    return (
                      <div key={doc.document_id} className="px-5 py-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-lg">{getFileIcon(doc.file_type)}</span>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap overflow-hidden text-ellipsis max-w-[430px]" title={doc.original_filename}>
                              {doc.original_filename}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {doc.uploaded_by_name || "-"} • {new Date(doc.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => handleDownload(doc)} className="px-3 py-1 rounded-md bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300">Download</button>
                          {isPreviewSupported(doc.file_type) && <button type="button" onClick={() => handlePreview(doc)} className="px-3 py-1 rounded-md bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300">Preview</button>}
                          {canManage && (
                            <>
                              <button type="button" onClick={() => handleTogglePin(doc)} className="px-3 py-1 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200">{doc.is_pinned ? "Unpin" : "Pin"}</button>
                              <button type="button" onClick={() => handleDelete(doc)} className="px-3 py-1 rounded-md bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300">Delete</button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {sectionedDocuments.projectsList.map((section) => (
              <div key={section.projectName} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
                <div className="bg-gray-100 dark:bg-gray-700 px-5 py-3 border-b border-gray-200 dark:border-gray-600 flex justify-between">
                  <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{section.projectName}</h2>
                  <span className="text-sm text-gray-600 dark:text-gray-300">{section.documents.length} file{section.documents.length === 1 ? "" : "s"}</span>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {section.documents.map((doc) => {
                    return (
                      <div key={doc.document_id} className="px-5 py-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-lg">{getFileIcon(doc.file_type)}</span>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap overflow-hidden text-ellipsis max-w-[430px]" title={doc.original_filename}>
                              {doc.original_filename}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {(doc.test_area || "No test area")} • {doc.uploaded_by_name || "-"} • {new Date(doc.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => handleDownload(doc)} className="px-3 py-1 rounded-md bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300">Download</button>
                          {isPreviewSupported(doc.file_type) && <button type="button" onClick={() => handlePreview(doc)} className="px-3 py-1 rounded-md bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300">Preview</button>}
                          {canManage && (
                            <>
                              <button type="button" onClick={() => handleTogglePin(doc)} className="px-3 py-1 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200">{doc.is_pinned ? "Unpin" : "Pin"}</button>
                              <button type="button" onClick={() => handleDelete(doc)} className="px-3 py-1 rounded-md bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300">Delete</button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {previewOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={closePreview}
        >
          <div
            className="w-full max-w-5xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 break-all pr-4">
                Preview: {previewTitle}
              </h3>
              <button
                type="button"
                onClick={closePreview}
                className="px-3 py-1 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
              >
                Close
              </button>
            </div>

            <div className="bg-gray-50 dark:bg-gray-900 p-3">
              {previewLoading ? (
                <div className="h-[70vh] flex items-center justify-center text-gray-600 dark:text-gray-300">
                  Loading preview...
                </div>
              ) : previewType === "image" ? (
                <div className="h-[70vh] overflow-auto flex items-center justify-center">
                  <img
                    src={previewUrl}
                    alt={previewTitle}
                    className="max-w-full max-h-full object-contain rounded"
                  />
                </div>
              ) : (
                <iframe
                  src={previewUrl}
                  title={previewTitle}
                  className="w-full h-[70vh] rounded bg-white"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
