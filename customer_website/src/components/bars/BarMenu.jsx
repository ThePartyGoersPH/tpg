import { imageUrl } from '../../utils/imageUrl';
import EmptyState from '../ui/EmptyState';

function BarMenu({ menuItems }) {
  if (!menuItems.length) {
    return <EmptyState title="No menu items yet" subtitle="This bar has not published menu items." />;
  }

  return (
    <div className="grid menu-grid">
      {menuItems.map((item) => (
        <article className="card" key={item.id}>
          <img className="menu-thumb" src={imageUrl(item.image_path) || `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='180' viewBox='0 0 300 180'%3E%3Crect width='300' height='180' fill='%23161616'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='40' fill='%23333'%3E%F0%9F%8D%BD%3C/text%3E%3C/svg%3E`} alt={item.menu_name} />
          <h4>{item.menu_name}</h4>
          <p className="section-subtitle">{item.category || 'General'}</p>
          <p>{item.menu_description || 'No description available.'}</p>
          <strong>PHP {item.selling_price}</strong>
        </article>
      ))}
    </div>
  );
}

export default BarMenu;
