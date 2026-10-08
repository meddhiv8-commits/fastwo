import {
  ArrowLeft,
  Camera,
  ImagePlus,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { categories } from "../data/demoData.js";
import { useMarketplace } from "../context/MarketplaceContext.jsx";
import { calculateCommission } from "../lib/commission.js";
import { saveUploadedPhoto } from "../lib/photoStorage.js";

const sellCategories = categories.filter(
  (category) => category.value !== "all",
);

const photoSlots = [
  ...Array.from({ length: 6 }, (_, index) => ({
    id: `angle-${index + 1}`,
    label: `Angle ${index + 1}`,
    kind: "angle",
  })),
  { id: "defect-1", label: "Rayure 1 (opt.)", kind: "defect" },
  { id: "defect-2", label: "Rayure 2 (opt.)", kind: "defect" },
];

const categoryFields = {
  Sneakers: {
    brand: "ex. Nike, Adidas, Jordan",
    modelLabel: "Modèle",
    model: "ex. Air Jordan 1 Retro",
  },
  Watch: {
    brand: "ex. Tissot, Seiko, Casio",
    modelLabel: "Modèle de la montre",
    model: "ex. PRX Automatic, G-Shock",
  },
  Apple: {
    brand: "Apple",
    modelLabel: "Modèle et capacité",
    model: "ex. iPhone 15 Pro 256 Go",
  },
  Gaming: {
    brand: "ex. Sony, Microsoft, Nintendo",
    modelLabel: "Console ou accessoire",
    model: "ex. PlayStation 5 Slim",
  },
  Accessoires: {
    brand: "ex. Cartier, Tiffany, autre",
    modelLabel: "Type d’accessoire",
    model: "ex. Collier argent 925",
  },
  Lunettes: {
    brand: "ex. Ray-Ban, Oakley",
    modelLabel: "Modèle des lunettes",
    model: "ex. Aviator Classic",
  },
  Bags: {
    brand: "ex. Louis Vuitton, Zara",
    modelLabel: "Modèle du sac",
    model: "ex. Neverfull MM",
  },
  Parfums: {
    brand: "ex. Dior, Chanel, YSL",
    modelLabel: "Parfum et contenance",
    model: "ex. Sauvage Eau de Toilette 100 ml",
  },
};

const photoTips = {
  Sneakers: [
    "Photograph les deux côtés et le dessus, bien alignés.",
    "Montre la semelle et l’étiquette de pointure.",
    "Ajoute un gros plan sur les plis ou traces d’usure.",
  ],
  Watch: [
    "Photographie le cadran de face, sans reflet de flash.",
    "Ajoute le dos, le bracelet et les éléments fournis.",
    "Fais un gros plan des rayures et de la couronne.",
  ],
  Apple: [
    "Montre l’écran allumé puis éteint, sans reflets.",
    "Photographie les bords, le dos et les accessoires.",
    "Cache les numéros de série et données personnelles.",
  ],
  Parfums: [
    "Photographie le flacon droit, face à la lumière.",
    "Montre le niveau de parfum et la boîte si disponible.",
    "Photographie le bouchon et les éventuelles marques.",
  ],
  Bags: [
    "Montre le sac entier de face, de dos et de côté.",
    "Photographie l’intérieur, les anses et les fermetures.",
    "Montre les coins et toutes les traces d’usage.",
  ],
  default: [
    "Cadre l’article en entier sur un fond simple.",
    "Approche-toi pour montrer les détails importants.",
    "Photographie honnêtement les défauts éventuels.",
  ],
};

export default function SellPage() {
  const { submitProduct, user, t } = useMarketplace();
  const [error, setError] = useState("");
  const [category, setCategory] = useState("");
  const [appleType, setAppleType] = useState("");
  const [batteryHealth, setBatteryHealth] = useState("");
  const [faceIdEnabled, setFaceIdEnabled] = useState("");
  const [trueToneEnabled, setTrueToneEnabled] = useState("");
  const [repaired, setRepaired] = useState("");
  const [repairType, setRepairType] = useState("");
  const [sellerPrice, setSellerPrice] = useState("");
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const photoPreviews = useRef([]);
  const navigate = useNavigate();
  const tips = photoTips[category] || photoTips.default;
  const fields = categoryFields[category] || {
    brand: "Choisissez d’abord une catégorie",
    modelLabel: "Modèle",
    model: "Nom du produit",
  };

  useEffect(
    () => () =>
      photoPreviews.current.forEach((photo) =>
        URL.revokeObjectURL(photo.preview),
      ),
    [],
  );

  function selectAppleType(nextAppleType) {
    setAppleType(nextAppleType);
    setBatteryHealth("");
    setFaceIdEnabled("");
    setTrueToneEnabled("");
    setRepaired("");
    setRepairType("");
  }

  function selectPhoto(event, slotId, kind) {
    const file = Array.from(event.target.files || []).find((item) =>
      item.type.startsWith("image/"),
    );
    if (!file) return;
    setSelectedPhotos((current) => {
      const previous = current.find((photo) => photo.slotId === slotId);
      if (previous) URL.revokeObjectURL(previous.preview);
      const next = [
        ...current.filter((photo) => photo.slotId !== slotId),
        { file, preview: URL.createObjectURL(file), slotId, kind },
      ];
      photoPreviews.current = next;
      return next;
    });
    setError("");
    event.target.value = "";
  }

  function removePhoto(slotId) {
    setSelectedPhotos((current) => {
      const removed = current.find((photo) => photo.slotId === slotId);
      if (removed) URL.revokeObjectURL(removed.preview);
      const next = current.filter((photo) => photo.slotId !== slotId);
      photoPreviews.current = next;
      return next;
    });
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    const form = new FormData(event.currentTarget);
    const sellerPrice = Number(form.get("price"));
    const commission = calculateCommission(sellerPrice);
    const imageUrl = String(form.get("image") || "").trim();
    const excludedFields = new Set([
      "category",
      "condition",
      "brand",
      "model",
      "size",
      "price",
      "image",
    ]);
    const customAttributes = [...new Map(form.entries()).entries()]
      .filter(
        ([key, value]) =>
          !excludedFields.has(key) &&
          typeof value === "string" &&
          value.trim() !== "",
      )
      .map(([key, value]) => {
        const field = event.currentTarget.querySelector(
          `[name="${CSS.escape(key)}"]`,
        );
        const legend = field?.closest("fieldset")?.querySelector("legend");
        const label = field?.closest("label");
        const labelCopy = label?.cloneNode(true);
        labelCopy
          ?.querySelectorAll("input, select, textarea, button")
          .forEach((control) => control.remove());
        const labelText = (legend?.textContent || labelCopy?.textContent || key)
          .replace(/\s+/g, " ")
          .trim();
        return { key, label: labelText, value: value.trim() };
      });
    try {
      const uploadedImages = await Promise.all(
        selectedPhotos.map(({ file }) => saveUploadedPhoto(file)),
      );
      const images = [...uploadedImages, ...(imageUrl ? [imageUrl] : [])].slice(
        0,
        8,
      );
      submitProduct({
        category: form.get("category"),
        condition: form.get("condition"),
        brand: String(form.get("brand")).trim(),
        model: String(form.get("model")).trim(),
        taille: String(form.get("size") || "").trim(),
        appleType: category === "Apple" ? form.get("appleType") : null,
        batteryHealth:
          category === "Apple"
            ? String(form.get("batteryHealth") || "").trim()
            : null,
        faceIdEnabled:
          category === "Apple" && appleType === "iPhone"
            ? form.get("faceIdEnabled")
            : null,
        trueToneEnabled:
          category === "Apple" && appleType === "iPhone"
            ? form.get("trueToneEnabled")
            : null,
        repaired: category === "Apple" ? form.get("repaired") : null,
        repairType:
          category === "Apple" && repaired === "yes"
            ? String(form.get("repairType") || "").trim()
            : null,
        sellerPrice,
        finalPrice: commission.publicPrice,
        commissionRate: commission.rate,
        commissionAmount: commission.commission,
        sellerPayout: commission.sellerPayout,
        customAttributes,
        images: images.length
          ? images
          : [
              "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=85",
            ],
      });
      navigate("/seller");
    } catch (issue) {
      setError(issue.message || "Impossible d’enregistrer les photos.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="form-page">
      <Link to="/seller" className="back-link">
        <ArrowLeft size={16} /> {t("Espace vendeur")}
      </Link>
      <div className="form-page-heading">
        <p className="eyebrow">{t("VENDEZ SUR FASTWO")}</p>
        <h1>
          {t("Une nouvelle vie")}
          <br />
          {t("pour votre article.")}
        </h1>
        <p>{t("Votre annonce sera vérifiée avant d’être publiée.")}</p>
      </div>
      <form className="listing-form" onSubmit={submit}>
        <div className="form-section-title">
          <span>01</span>
          <div>
            <h2>{t("L’article")}</h2>
            <p>{t("Commencez par nous le présenter.")}</p>
          </div>
        </div>
        <div className="field-grid">
          <label>
            {t("Catégorie")}
            <select
              name="category"
              required
              value={category}
              onChange={(event) => {
                setCategory(event.target.value);
                if (event.target.value !== "Apple") {
                  setAppleType("");
                  setBatteryHealth("");
                  setFaceIdEnabled("");
                  setTrueToneEnabled("");
                  setRepaired("");
                  setRepairType("");
                }
              }}
            >
              <option value="" disabled>
                {t("Choisir une catégorie")}
              </option>
              {sellCategories.map((item) => (
                <option value={item.value} key={item.value}>
                  {t(item.name)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("État")}
            <select name="condition" required defaultValue="A">
              <option value="S">S · {t("Neuf")}</option>
              <option value="A">A · {t("Très bon")}</option>
              <option value="B">B · {t("Bon")}</option>
              <option value="C">C · {t("Utilisé")}</option>
            </select>
          </label>
          <label>
            {t("Marque")}
            <input name="brand" required placeholder={fields.brand} />
          </label>
          <label>
            {t(fields.modelLabel)}
            <input name="model" required placeholder={fields.model} />
          </label>
          {category === "Sneakers" && (
            <label>
              {t("Pointure (EU)")}
              <input name="size" required placeholder="ex. 42" />
            </label>
          )}
          {category === "Apple" && (
            <>
              <label>
                {t("Type de produit")}
                <select
                  name="appleType"
                  required
                  value={appleType}
                  onChange={(event) => selectAppleType(event.target.value)}
                >
                  <option value="" disabled>
                    {t("Choisir un modèle")}
                  </option>
                  <option value="iPhone">iPhone</option>
                  <option value="iPad">iPad</option>
                  <option value="MacBook">MacBook</option>
                  <option value="AirPods">AirPods</option>
                  <option value="Apple Watch">Apple Watch</option>
                  <option value="Apple TV">Apple TV</option>
                  <option value="Vision Pro">Vision Pro</option>
                </select>
              </label>
              {(appleType === "iPhone" ||
                appleType === "MacBook" ||
                appleType === "Apple Watch") && (
                <label>
                  {t("État batterie")}
                  <input
                    name="batteryHealth"
                    required
                    type="number"
                    min="0"
                    max="100"
                    placeholder="ex. 92"
                    value={batteryHealth}
                    onChange={(event) => setBatteryHealth(event.target.value)}
                  />
                </label>
              )}
              {appleType === "iPhone" && (
                <fieldset className="conditional-fieldset">
                  <legend>{t("Face ID activé")}</legend>
                  <div className="choice-toggle-group">
                    <label>
                      <input
                        type="radio"
                        name="faceIdEnabled"
                        value="yes"
                        checked={faceIdEnabled === "yes"}
                        onChange={(event) =>
                          setFaceIdEnabled(event.target.value)
                        }
                      />
                      {t("Oui")}
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="faceIdEnabled"
                        value="no"
                        checked={faceIdEnabled === "no"}
                        onChange={(event) =>
                          setFaceIdEnabled(event.target.value)
                        }
                      />
                      {t("Non")}
                    </label>
                  </div>
                </fieldset>
              )}
              {appleType === "iPhone" && (
                <fieldset className="conditional-fieldset">
                  <legend>{t("True Tone")}</legend>
                  <div className="choice-toggle-group">
                    <label>
                      <input
                        type="radio"
                        name="trueToneEnabled"
                        value="yes"
                        checked={trueToneEnabled === "yes"}
                        onChange={(event) =>
                          setTrueToneEnabled(event.target.value)
                        }
                      />
                      {t("Oui")}
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="trueToneEnabled"
                        value="no"
                        checked={trueToneEnabled === "no"}
                        onChange={(event) =>
                          setTrueToneEnabled(event.target.value)
                        }
                      />
                      {t("Non")}
                    </label>
                  </div>
                </fieldset>
              )}
              <fieldset className="conditional-fieldset">
                <legend>{t("Réparé")}</legend>
                <div className="choice-toggle-group">
                  <label>
                    <input
                      type="radio"
                      name="repaired"
                      value="yes"
                      checked={repaired === "yes"}
                      onChange={(event) => setRepaired(event.target.value)}
                    />
                    {t("Oui")}
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="repaired"
                      value="no"
                      checked={repaired === "no"}
                      onChange={(event) => setRepaired(event.target.value)}
                    />
                    {t("Non")}
                  </label>
                </div>
              </fieldset>
              {repaired === "yes" && (
                <label>
                  {t("Type de réparation")}
                  <input
                    name="repairType"
                    required
                    placeholder="ex. Écran, caméra, batterie"
                    value={repairType}
                    onChange={(event) => setRepairType(event.target.value)}
                  />
                </label>
              )}
            </>
          )}
          <label>
            {t("Votre prix souhaité")} <small>(TND)</small>
            <input
              name="price"
              required
              type="number"
              min="1"
              step="1"
              placeholder="ex. 450"
              value={sellerPrice}
              onChange={(event) => setSellerPrice(event.target.value)}
            />
          </label>
          <div className="commission-preview" aria-live="polite">
            {(() => {
              const commission = calculateCommission(sellerPrice);
              return (
                <>
                  <div>
                    <span>{t("Taux Fastwo")}</span>
                    <strong>{commission.rate * 100}%</strong>
                  </div>
                  <div>
                    <span>{t("Commission")}</span>
                    <strong>{commission.commission.toFixed(2)} TND</strong>
                  </div>
                  <div>
                    <span>{t("Prix original")}</span>
                    <strong>{commission.sellerPayout.toFixed(2)} TND</strong>
                  </div>
                  <div className="commission-final-price">
                    <span>{t("Prix affiché")}</span>
                    <strong>{commission.publicPrice.toFixed(2)} TND</strong>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
        <div className="form-section-title form-section-next">
          <span>02</span>
          <div>
            <h2>{t("Les photos")}</h2>
            <p>{t("Ajoutez 6 angles et jusqu’à 2 photos de défaut.")}</p>
          </div>
        </div>
        <div className="photo-upload-area">
          <div className="photo-slot-grid">
            {photoSlots.map((slot) => {
              const photo = selectedPhotos.find(
                (item) => item.slotId === slot.id,
              );
              return (
                <div
                  className={`photo-slot ${slot.kind === "defect" ? "photo-slot-defect" : ""} ${photo ? "is-filled" : ""}`}
                  key={slot.id}
                >
                  <label htmlFor={slot.id}>
                    {photo ? (
                      <img src={photo.preview} alt={slot.label} />
                    ) : (
                      <>
                        <Camera size={20} />
                        <span>{slot.label}</span>
                        <small>
                          {slot.kind === "defect"
                            ? t("Optionnel")
                            : t("Ajouter une photo")}
                        </small>
                      </>
                    )}
                    <input
                      id={slot.id}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(event) =>
                        selectPhoto(event, slot.id, slot.kind)
                      }
                    />
                  </label>
                  {photo && (
                    <button
                      type="button"
                      onClick={() => removePhoto(slot.id)}
                      aria-label={`${t("Supprimer")} ${t(slot.label)}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <small className="photo-upload-note">
            {t("JPG, PNG ou HEIC · 8 photos maximum")}
          </small>
        </div>
        <section className="photo-guide" aria-labelledby="photo-guide-title">
          <div className="photo-guide-heading">
            <ImagePlus size={17} />
            <div>
              <h3 id="photo-guide-title">{t("Le petit guide photo")}</h3>
              <p>
                {t(
                  "Une lumière douce et quelques angles nets font la différence.",
                )}
              </p>
            </div>
          </div>
          <ol>
            {tips.map((tip, index) => (
              <li key={tip}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                {tip}
              </li>
            ))}
          </ol>
        </section>
        <label className="image-url-field">
          <ImagePlus size={19} />
          <span>{t("Ou ajouter une photo par URL")}</span>
          <input name="image" type="url" placeholder="https://…" />
        </label>
        <p className="form-note">
          {t("Connectez votre espace vendeur avec")}{" "}
          <strong>{user?.name}</strong>.
          {t("Fastwo calcule le prix public indicatif automatiquement.")}
        </p>
        {error && <p className="form-error">{error}</p>}
        <div className="listing-form-footer">
          <Link className="button-secondary" to="/seller">
            {t("Annuler")}
          </Link>
          <button className="button-primary" type="submit">
            <UploadCloud size={17} />
            {isSubmitting
              ? t("Préparation des photos…")
              : t("Soumettre l’annonce")}
          </button>
        </div>
      </form>
    </section>
  );
}
