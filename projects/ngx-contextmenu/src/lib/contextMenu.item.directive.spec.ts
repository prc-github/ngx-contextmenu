import { ContextMenuItemDirective } from './contextMenu.item.directive';

describe('ContextMenuItemDirective', () => {
  let directive: ContextMenuItemDirective;

  beforeEach(() => {
    directive = new ContextMenuItemDirective(null as any, null as any);
  });

  describe('defaults', () => {
    it('is enabled, visible and neither divider nor passive', () => {
      expect(directive.enabled).toBe(true);
      expect(directive.visible).toBe(true);
      expect(directive.divider).toBe(false);
      expect(directive.passive).toBe(false);
      expect(directive.disabled).toBe(false);
    });
  });

  describe('disabled', () => {
    it('is true for passive items', () => {
      directive.passive = true;
      expect(directive.disabled).toBe(true);
    });

    it('is true for dividers', () => {
      directive.divider = true;
      expect(directive.disabled).toBe(true);
    });

    it('is true when enabled is false', () => {
      directive.enabled = false;
      expect(directive.disabled).toBe(true);
    });

    it('evaluates an enabled function against the current item', () => {
      const enabled = vi.fn((item: any) => item.allowed);
      directive.enabled = enabled;

      directive.currentItem = { allowed: true };
      expect(directive.disabled).toBe(false);

      directive.currentItem = { allowed: false };
      expect(directive.disabled).toBe(true);

      expect(enabled).toHaveBeenCalledWith({ allowed: false });
    });
  });

  describe('active styles', () => {
    it('toggles isActive', () => {
      directive.setActiveStyles();
      expect(directive.isActive).toBe(true);
      directive.setInactiveStyles();
      expect(directive.isActive).toBe(false);
    });
  });

  describe('triggerExecute', () => {
    it('emits the item and the triggering event when enabled', () => {
      const listener = vi.fn();
      directive.execute.subscribe(listener);
      const item = { name: 'John' };
      const event = new MouseEvent('click');

      directive.triggerExecute(item, event);

      expect(listener).toHaveBeenCalledExactlyOnceWith({ event, item });
    });

    it('does not emit when enabled is false', () => {
      const listener = vi.fn();
      directive.execute.subscribe(listener);
      directive.enabled = false;

      directive.triggerExecute({});

      expect(listener).not.toHaveBeenCalled();
    });

    it('evaluates an enabled function against the given item', () => {
      const listener = vi.fn();
      directive.execute.subscribe(listener);
      directive.enabled = (item: any) => item.name === 'John';

      directive.triggerExecute({ name: 'Joe' });
      expect(listener).not.toHaveBeenCalled();

      directive.triggerExecute({ name: 'John' });
      expect(listener).toHaveBeenCalledOnce();
    });
  });
});
