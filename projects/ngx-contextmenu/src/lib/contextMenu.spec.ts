import { OverlayContainer } from '@angular/cdk/overlay';
import { Component, ViewChild, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ContextMenuComponent } from './contextMenu.component';
import { IContextMenuOptions } from './contextMenu.options';
import { CloseContextMenuEvent, ContextMenuService, IContextMenuClickEvent } from './contextMenu.service';
import { ContextMenuModule } from './ngx-contextmenu';

interface Person {
  name: string;
  admin?: boolean;
  locked?: boolean;
}

@Component({
  imports: [ContextMenuModule],
  template: `
    <div id="target" [contextMenu]="menu" [contextMenuSubject]="person()">Right click me</div>

    <context-menu
      #menu
      menuClass="custom-menu"
      [disabled]="menuDisabled()"
      (open)="opened.push($event)"
      (close)="closed.push($event)"
    >
      <ng-template contextMenuItem let-item (execute)="executed.push({ action: 'hi', item: $event.item })">
        Say hi, {{ item?.name }}
      </ng-template>
      <ng-template contextMenuItem divider="true"></ng-template>
      <ng-template contextMenuItem [visible]="isAdmin">Admin only</ng-template>
      <ng-template contextMenuItem [enabled]="canDelete" (execute)="executed.push({ action: 'delete', item: $event.item })">
        Delete
      </ng-template>
      <ng-template contextMenuItem passive="true">Passive</ng-template>
      <ng-template contextMenuItem [subMenu]="subMenu">More</ng-template>
    </context-menu>

    <context-menu #subMenu (close)="subClosed.push($event)">
      <ng-template contextMenuItem (execute)="executed.push({ action: 'sub', item: $event.item })">Sub item</ng-template>
    </context-menu>
  `,
})
class HostComponent {
  @ViewChild('menu', { static: true }) public menu: ContextMenuComponent;
  @ViewChild('subMenu', { static: true }) public subMenu: ContextMenuComponent;

  public person = signal<Person>({ name: 'John' });
  public menuDisabled = signal(false);
  public opened: IContextMenuClickEvent[] = [];
  public closed: CloseContextMenuEvent[] = [];
  public subClosed: CloseContextMenuEvent[] = [];
  public executed: { action: string; item: Person }[] = [];

  public isAdmin = (item: Person) => !!item.admin;
  public canDelete = (item: Person) => !item.locked;
}

function setup(options?: IContextMenuOptions): ComponentFixture<HostComponent> {
  TestBed.configureTestingModule({
    imports: [ContextMenuModule.forRoot(options), HostComponent],
  });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  return fixture;
}

function overlayContainer(): HTMLElement {
  return TestBed.inject(OverlayContainer).getContainerElement();
}

/** All currently open menus (root first, then sub-menus). */
function openMenus(): HTMLUListElement[] {
  return Array.from(overlayContainer().querySelectorAll<HTMLUListElement>('ul.dropdown-menu'));
}

function menuItems(menu: HTMLElement): HTMLLIElement[] {
  return Array.from(menu.querySelectorAll<HTMLLIElement>(':scope > li'));
}

function itemByText(menu: HTMLElement, text: string): HTMLLIElement {
  const li = menuItems(menu).find(el => el.textContent.trim().startsWith(text));
  if (!li) {
    throw new Error(`No menu item starting with "${text}"`);
  }
  return li;
}

function rightClick(element: Element): MouseEvent {
  const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 20 });
  element.dispatchEvent(event);
  return event;
}

function click(element: Element): MouseEvent {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
  element.dispatchEvent(event);
  return event;
}

function keydown(key: string, keyCode: number): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  // jsdom ignores `keyCode` in the init dict, but the CDK key manager relies on it.
  Object.defineProperty(event, 'keyCode', { get: () => keyCode });
  document.body.dispatchEvent(event);
  return event;
}

/** destroyLeafMenu() defers its work with setTimeout. */
function nextMacrotask(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve));
}

describe('ngx-contextmenu', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let target: HTMLElement;

  function openRootMenu(): HTMLUListElement {
    rightClick(target);
    const [menu] = openMenus();
    expect(menu).toBeDefined();
    return menu;
  }

  describe('with default options', () => {
    beforeEach(() => {
      fixture = setup();
      host = fixture.componentInstance;
      target = fixture.nativeElement.querySelector('#target');
    });

    describe('opening', () => {
      it('does not render a menu before a right click', () => {
        expect(openMenus()).toHaveLength(0);
      });

      it('opens the menu on right click and suppresses the native context menu', () => {
        const event = rightClick(target);

        expect(openMenus()).toHaveLength(1);
        expect(event.defaultPrevented).toBe(true);
      });

      it('emits open with the subject item and the triggering event', () => {
        const event = rightClick(target);

        expect(host.opened).toHaveLength(1);
        expect(host.opened[0].item).toBe(host.person());
        expect(host.opened[0].event).toBe(event);
        expect(host.opened[0].contextMenu).toBe(host.menu);
      });

      it('applies menuClass to the menu wrapper', () => {
        openRootMenu();

        expect(overlayContainer().querySelector('div.ngx-contextmenu.custom-menu')).not.toBeNull();
      });

      it('passes the subject item to item templates', () => {
        const menu = openRootMenu();

        expect(itemByText(menu, 'Say hi').textContent).toContain('Say hi, John');
      });

      it('does not open when the context menu is disabled', () => {
        host.menuDisabled.set(true);
        fixture.detectChanges();

        const event = rightClick(target);

        expect(openMenus()).toHaveLength(0);
        expect(event.defaultPrevented).toBe(false);
        expect(host.opened).toHaveLength(0);
      });

      it('replaces an already open menu when right clicking again', () => {
        openRootMenu();
        rightClick(target);

        expect(openMenus()).toHaveLength(1);
        expect(host.closed).toEqual([expect.objectContaining({ eventType: 'cancel' })]);
      });

      it('can be opened programmatically through ContextMenuService', () => {
        const service = TestBed.inject(ContextMenuService);
        const item = { name: 'Joe' };

        service.show.next({ contextMenu: host.menu, event: new MouseEvent('click'), item });

        expect(openMenus()).toHaveLength(1);
        expect(itemByText(openMenus()[0], 'Say hi').textContent).toContain('Say hi, Joe');
      });
    });

    describe('item rendering', () => {
      it('renders a divider as a separator', () => {
        const menu = openRootMenu();
        const divider = menuItems(menu).find(li => li.classList.contains('divider'));

        expect(divider).toBeDefined();
        expect(divider.getAttribute('role')).toBe('separator');
        expect(divider.querySelector('a, span')).toBeNull();
      });

      it('renders passive items as a span instead of a link', () => {
        const passive = itemByText(openRootMenu(), 'Passive');

        expect(passive.querySelector('span.passive')).not.toBeNull();
        expect(passive.querySelector('a')).toBeNull();
      });

      it('marks items with a sub-menu', () => {
        const more = itemByText(openRootMenu(), 'More');

        expect(more.querySelector('a.hasSubMenu')).not.toBeNull();
      });

      it('hides items whose visible function returns false', () => {
        const menu = openRootMenu();

        expect(menu.textContent).not.toContain('Admin only');
      });

      it('shows items whose visible function returns true', () => {
        host.person.set({ name: 'John', admin: true });
        fixture.detectChanges();

        const menu = openRootMenu();

        expect(menu.textContent).toContain('Admin only');
      });

      it('marks items whose enabled function returns false as disabled', () => {
        host.person.set({ name: 'John', locked: true });
        fixture.detectChanges();

        const del = itemByText(openRootMenu(), 'Delete');

        expect(del.classList).toContain('disabled');
      });
    });

    describe('executing items', () => {
      it('emits execute with the subject item when an item is clicked', () => {
        const menu = openRootMenu();

        click(itemByText(menu, 'Say hi').querySelector('a'));

        expect(host.executed).toEqual([{ action: 'hi', item: host.person() }]);
      });

      it('closes the menu and emits close with eventType "execute"', () => {
        const menu = openRootMenu();
        const event = click(itemByText(menu, 'Say hi').querySelector('a'));

        expect(openMenus()).toHaveLength(0);
        expect(host.closed).toHaveLength(1);
        expect(host.closed[0]).toEqual(expect.objectContaining({ eventType: 'execute', item: host.person(), event }));
      });

      it('prevents the default link navigation', () => {
        const event = click(itemByText(openRootMenu(), 'Say hi').querySelector('a'));

        expect(event.defaultPrevented).toBe(true);
      });

      it('does not execute disabled items and keeps the menu open', () => {
        host.person.set({ name: 'John', locked: true });
        fixture.detectChanges();

        click(itemByText(openRootMenu(), 'Delete').querySelector('a'));

        expect(host.executed).toEqual([]);
        expect(openMenus()).toHaveLength(1);
      });

      it('keeps the menu open when a passive item is clicked', () => {
        click(itemByText(openRootMenu(), 'Passive').querySelector('span'));

        expect(openMenus()).toHaveLength(1);
        expect(host.closed).toHaveLength(0);
      });
    });

    describe('closing', () => {
      it('closes on a left click outside the menu and emits close with eventType "cancel"', () => {
        openRootMenu();

        const event = click(document.body);

        expect(openMenus()).toHaveLength(0);
        expect(host.closed).toEqual([{ eventType: 'cancel', event }]);
      });

      it('ignores right button click events', () => {
        openRootMenu();

        document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 2 }));

        expect(openMenus()).toHaveLength(1);
      });

      it('closes when a context menu is opened elsewhere on the page', () => {
        openRootMenu();

        rightClick(document.body);

        expect(openMenus()).toHaveLength(0);
      });

      it('closes on Escape', async () => {
        openRootMenu();

        const event = keydown('Escape', 27);
        await nextMacrotask();

        expect(event.defaultPrevented).toBe(true);
        expect(openMenus()).toHaveLength(0);
        expect(host.closed).toEqual([{ eventType: 'cancel', event }]);
      });

      it('can be closed programmatically through ContextMenuService', () => {
        openRootMenu();

        TestBed.inject(ContextMenuService).closeAllContextMenus({ eventType: 'cancel' });

        expect(openMenus()).toHaveLength(0);
        expect(host.closed).toEqual([{ eventType: 'cancel' }]);
      });
    });

    describe('sub-menus', () => {
      function openSubMenu(): HTMLUListElement[] {
        const more = itemByText(openRootMenu(), 'More');
        more.querySelector('a').dispatchEvent(new MouseEvent('mouseenter'));
        const menus = openMenus();
        expect(menus).toHaveLength(2);
        return menus;
      }

      it('opens the sub-menu when hovering an item with a sub-menu', () => {
        const [, sub] = openSubMenu();

        expect(sub.textContent).toContain('Sub item');
      });

      it('opens the sub-menu instead of executing when clicking an item with a sub-menu', () => {
        click(itemByText(openRootMenu(), 'More').querySelector('a'));

        expect(openMenus()).toHaveLength(2);
        expect(host.executed).toEqual([]);
        expect(host.closed).toEqual([]);
      });

      it('closes the sub-menu when hovering another item', () => {
        const [root] = openSubMenu();

        itemByText(root, 'Say hi').querySelector('a').dispatchEvent(new MouseEvent('mouseenter'));

        expect(openMenus()).toHaveLength(1);
      });

      it('executes sub-menu items with the root subject item and closes all menus', () => {
        const [, sub] = openSubMenu();

        click(itemByText(sub, 'Sub item').querySelector('a'));

        expect(host.executed).toEqual([{ action: 'sub', item: host.person() }]);
        expect(openMenus()).toHaveLength(0);
      });

      it('closes only the sub-menu on ArrowLeft', async () => {
        openSubMenu();

        keydown('ArrowLeft', 37);
        await nextMacrotask();

        const menus = openMenus();
        expect(menus).toHaveLength(1);
        expect(menus[0].textContent).toContain('Say hi');
      });
    });

    describe('keyboard navigation', () => {
      it('highlights the first enabled item on ArrowDown', async () => {
        const menu = openRootMenu();

        keydown('ArrowDown', 40);
        await fixture.whenStable();

        expect(itemByText(menu, 'Say hi').classList).toContain('active');
      });

      it('skips dividers and disabled items', async () => {
        host.person.set({ name: 'John', locked: true });
        fixture.detectChanges();
        const menu = openRootMenu();

        keydown('ArrowDown', 40);
        keydown('ArrowDown', 40);
        await fixture.whenStable();

        expect(itemByText(menu, 'More').classList).toContain('active');
      });

      it('executes the highlighted item on Enter', () => {
        openRootMenu();

        keydown('ArrowDown', 40);
        keydown('Enter', 13);

        expect(host.executed).toEqual([{ action: 'hi', item: host.person() }]);
        expect(openMenus()).toHaveLength(0);
      });

      it('opens the sub-menu of the highlighted item on ArrowRight', () => {
        openRootMenu();

        keydown('ArrowUp', 38); // wraps around to the last item ("More")
        keydown('ArrowRight', 39);

        expect(openMenus()).toHaveLength(2);
      });

      it('does not swallow key events that originate from form fields', () => {
        openRootMenu();
        const input = document.createElement('input');
        document.body.appendChild(input);

        const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
        input.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(false);
        input.remove();
      });
    });

    describe('cleanup', () => {
      it('stops listening to the service once destroyed', () => {
        const service = TestBed.inject(ContextMenuService);
        fixture.destroy();

        service.show.next({ event: new MouseEvent('click'), item: {} });

        expect(openMenus()).toHaveLength(0);
      });
    });
  });

  describe('with useBootstrap4', () => {
    beforeEach(() => {
      fixture = setup({ useBootstrap4: true });
      host = fixture.componentInstance;
      target = fixture.nativeElement.querySelector('#target');
    });

    it('adds Bootstrap 4 classes to items and dividers', () => {
      const menu = openRootMenu();

      expect(itemByText(menu, 'Say hi').querySelector('a.dropdown-item')).not.toBeNull();
      expect(menu.querySelector('li.divider.dropdown-divider')).not.toBeNull();
    });
  });

  describe('with autoFocus', () => {
    beforeEach(() => {
      fixture = setup({ autoFocus: true });
      host = fixture.componentInstance;
      target = fixture.nativeElement.querySelector('#target');
    });

    it('focuses the menu after opening', async () => {
      const menu = openRootMenu();
      await nextMacrotask();

      expect(document.activeElement).toBe(menu);
    });
  });
});
