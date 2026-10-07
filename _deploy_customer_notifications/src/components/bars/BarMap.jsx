function BarMap({ latitude, longitude, name }) {
  if (!latitude || !longitude) {
    return <p className="section-subtitle">No map coordinates available for this bar.</p>;
  }

  const mapLink = `https://www.google.com/maps?q=${latitude},${longitude}`;
  const osmEmbed = `https://www.openstreetmap.org/export/embed.html?bbox=${Number(longitude) - 0.01}%2C${Number(latitude) - 0.01}%2C${Number(longitude) + 0.01}%2C${Number(latitude) + 0.01}&layer=mapnik&marker=${latitude}%2C${longitude}`;

  return (
    <div className="card">
      <h3>Location</h3>
      <iframe title={`${name} map`} className="map-frame" src={osmEmbed} loading="lazy" />
      <a className="button ghost" href={mapLink} target="_blank" rel="noreferrer">
        Open in Google Maps
      </a>
    </div>
  );
}

export default BarMap;
